import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 13b'nin gerçek tarayıcı turu — IEC 60870-5-101.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/scada-utility/
 * iec-60870-5-101) Hazır rozetiyle açıldığı; FT1.2 link katmanının (Tek
 * Karakter Onayı, Sabit/Değişken Uzunluklu çerçeve, Control field bit
 * çözümü — AYNI bit PRM yönüne göre FARKLI ad taşıyor) ekranda gerçekten
 * çalıştığı; 104'ün `decodeAsdu()` çekirdeğinin PAYLAŞILDIĞI (ASDU alanları
 * — Type ID/Cause/Common Address/IOA/SIQ — aynı isimlerle basılıyor); checksum/
 * length-copy/end-byte hata yollarının doğru karta düştüğü; genişlik
 * `decodeOptions`inin (Link Address/Common Address/IOA/Cause of Transmission)
 * gerçekten alan yerleşimini değiştirdiği.
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır.
 * - `success:false` çerçevesi `decode-frame-error` DEĞİL `decode-parse-error`
 *   kartı basar (yalnız gerçekten `ParseFailure` olan örneklerde — soft hata
 *   yolları, ör. checksum/length-copy uyuşmazlığı, YİNE `success:true`
 *   döner ve `decode-frame-error` basar).
 * - `decode-field-raw` STRING rawValue'yu (`formatHexByte` ile üretilenler,
 *   ör. '0x68') OLDUĞU GİBİ basar; NUMBER rawValue'yu (`0x22 (34)` gibi,
 *   PADDİNGSİZ hex) kendi biçimlendirir — bu yüzden sayısal alanlarda
 *   `toContainText` ile ondalık kısım kontrol edilir, `toHaveText` değil.
 * - `unit` yalnız `physicalValue` DOLUYSA değere yapıştırılır.
 * - Birden çok çerçeve uyarısı/hatası varsa `.filter({hasText})` ile süzülür.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/scada-utility/iec-60870-5-101?tab=decode';

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

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test.describe('IEC 60870-5-101', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IEC 60870-5-101');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'iec-60870-5-101');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Tek Karakter Onayı (0xE5) örneği tek alan gösterir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('single-character-confirmation');

    await expect(fieldRow(page, 'confirmation').getByTestId('decode-field-raw')).toHaveText('0xE5');
    await expect(fieldRow(page, 'confirmation').getByTestId('decode-field-physical')).toHaveText('Confirmation');
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Sabit Uzunluklu link sıfırlama (PRM=1): control field bitleri ve fonksiyon adı doğru', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('fixed-length-reset-remote-link');

    await expect(fieldRow(page, 'prm').getByTestId('decode-field-raw')).toContainText('1');
    await expect(fieldRow(page, 'fcb-acd')).toContainText('FCB');
    await expect(fieldRow(page, 'fcv-dfc')).toContainText('FCV');
    await expect(fieldRow(page, 'function-code').getByTestId('decode-field-physical')).toHaveText(
      'Reset of remote link',
    );
    await expect(fieldRow(page, 'link-address').getByTestId('decode-field-raw')).toContainText('1');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.valid'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Sabit Uzunluklu ACK (PRM=0): AYNI fonksiyon kodu 0 farklı anlam taşır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('fixed-length-ack');

    await expect(fieldRow(page, 'prm').getByTestId('decode-field-raw')).toContainText('0');
    await expect(fieldRow(page, 'fcb-acd')).toContainText('ACD');
    await expect(fieldRow(page, 'fcv-dfc')).toContainText('DFC');
    await expect(fieldRow(page, 'function-code').getByTestId('decode-field-physical')).toHaveText(
      'ACK — positive acknowledgement',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('RES/DIR biti 1 örneği: alan ham gösterilir, tek bir yorum İDDİA EDİLMEZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('fixed-length-balanced-dir-bit');

    await expect(fieldRow(page, 'res-dir').getByTestId('decode-field-raw')).toContainText('1');
    await expect(fieldRow(page, 'res-dir').getByTestId('decode-field-physical')).toHaveText('—');
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan fonksiyon kodu (5) uyarı basar, çerçeve yine geçerli', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('fixed-length-unknown-function');

    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.iec101.warning.unknownFunctionCode'] }),
    ).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('checksum hatası örneği crc-mismatch benzeri karta düşer, alanlar yine çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('fixed-length-checksum-mismatch');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expect(fieldRow(page, 'function-code').getByTestId('decode-field-physical')).toHaveText(
      'Reset of remote link',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('değişken uzunluklu user data: ASDU alanları decodeAsdu() üzerinden 104 ile AYNI isimle basılır', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('variable-length-user-data');

    await expect(fieldRow(page, 'function-code').getByTestId('decode-field-physical')).toHaveText(
      'Send/confirm — user data',
    );
    await expect(fieldRow(page, 'type-id').getByTestId('decode-field-physical')).toHaveText(
      'M_SP_NA_1 — Single-point information',
    );
    await expect(fieldRow(page, 'cause-of-transmission').getByTestId('decode-field-physical')).toHaveText(
      'Spontaneous',
    );
    await expect(fieldRow(page, 'common-address').getByTestId('decode-field-raw')).toContainText('1');
    await expect(fieldRow(page, 'information-object-address').getByTestId('decode-field-raw')).toContainText(
      '1',
    );
    await expect(fieldRow(page, 'siq-spi').getByTestId('decode-field-raw')).toContainText('1');
    await expect(fieldRow(page, 'originator-address')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('secondary yanıtı (PRM=0, func=8): AYNI ASDU, karşı yönün fonksiyon adı', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('variable-length-secondary-response');

    await expect(fieldRow(page, 'function-code').getByTestId('decode-field-physical')).toHaveText(
      'Respond — user data',
    );
    await expect(fieldRow(page, 'type-id').getByTestId('decode-field-physical')).toHaveText(
      'M_SP_NA_1 — Single-point information',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('L kopyaları uyuşmazlığı: length-mismatch kartı, ASDU yine çözülür (success:true, soft hata)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('variable-length-copies-mismatch');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'length-mismatch');
    await expect(fieldRow(page, 'type-id').getByTestId('decode-field-physical')).toHaveText(
      'M_SP_NA_1 — Single-point information',
    );
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('gövde eksik örneği (L=20, tampon 6 bayt): decode-parse-error kartı (ParseFailure, decode-frame-error DEĞİL)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('variable-length-truncated');

    await expect(page.getByTestId('decode-parse-error')).toBeVisible();
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('genişlik decodeOptions gerçekten alan yerleşimini değiştirir (CA=1/IOA=2/COT=1, originator-address YOK)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);

    // Dar genişlikli elle inşa edilmiş çerçeve (bkz. iec101.test.ts'in aynı baytları).
    await page
      .getByLabel(tr['decode.hexInput.label'])
      .fill('68 09 09 68 53 01 01 01 03 01 01 00 01 5C 16');

    await page.getByLabel(tr['protocol.iec101.option.commonAddressWidth']).selectOption('1');
    await page.getByLabel(tr['protocol.iec101.option.informationObjectAddressWidth']).selectOption('2');
    await page.getByLabel(tr['protocol.iec101.option.causeOfTransmissionWidth']).selectOption('1');

    await expect(fieldRow(page, 'common-address').getByTestId('decode-field-raw')).toContainText('1');
    await expect(fieldRow(page, 'information-object-address').getByTestId('decode-field-raw')).toContainText(
      '1',
    );
    await expect(fieldRow(page, 'siq-spi').getByTestId('decode-field-raw')).toContainText('1');
    await expect(fieldRow(page, 'originator-address')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('link adresi genişliği 0: adres alanı hiç basılmaz, checksum/end kayar', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await page.getByLabel(tr['decode.hexInput.label']).fill('10 40 40 16');
    await page.getByLabel(tr['protocol.iec101.option.linkAddressWidth']).selectOption('0');

    await expect(fieldRow(page, 'link-address')).toHaveCount(0);
    await expect(fieldRow(page, 'function-code').getByTestId('decode-field-physical')).toHaveText(
      'Reset of remote link',
    );
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.valid'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IEC 60870-5-101');
    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('fixed-length-checksum-mismatch');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute('data-error-code', 'checksum-mismatch');
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('variable-length-user-data');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
