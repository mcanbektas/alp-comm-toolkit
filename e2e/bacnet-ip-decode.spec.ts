import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 6g'nin gerçek tarayıcı turu — BACnet/IP. Dalga 6'nın (6a-6g)
 * KAPANIŞI.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (building-automation/bacnet/bacnet-ip)
 * Hazır rozetiyle açıldığı; BVLC başlığının (Type/Function/Length) doğru
 * çözüldüğü; Original-Unicast-NPDU ve Original-Broadcast-NPDU'nun 6f'de
 * yazılan PAYLAŞILAN NPDU/APDU çekirdeğini (npdu.ts/apdu.ts) BVLL bağlamında
 * da doğru zincirlediği; Forwarded-NPDU'da 6 baytlık B/IP adresinin NPDU'dan
 * ÖNCE gösterildiği ve NPDU'nun ondan SONRA doğru çözüldüğü; BVLC-Result ve
 * Register-Foreign-Device gibi kapsam dışı fonksiyonların yalnız ad + ham
 * gövde bastığı (BBMD/Foreign Device tablo takibi YOK); Length tutarsızlığının
 * yalnız UYARI ürettiği (çerçeve yapısal olarak valid kalır); Type ≠ 0x81'in
 * gerçek bir çerçeve hatası (frame-level error, ParseFailure DEĞİL) ürettiği.
 *
 * BACnet/IP'nin alias sayfası YOK (katalog "Katalog yolları" tablosu) — alias
 * devralma testi burada yok. BEKÇİ BORCU yok (brief), ekstra iş gerekmedi.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/building-automation/bacnet/bacnet-ip?tab=decode';

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

test.describe('BACnet/IP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('BACnet/IP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'bacnet-ip');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Original-Unicast-NPDU / ReadProperty örneği BVLC başlığı + NPDU + APDU başlığını doğru basar', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('original-unicast-npdu-read-property');

    const type = fieldRow(page, 'bvlc-type');
    await expect(type.getByTestId('decode-field-physical')).toHaveText('BACnet/IP (Annex J)');

    const bvlcFunction = fieldRow(page, 'bvlc-function');
    await expect(bvlcFunction.getByTestId('decode-field-physical')).toHaveText('Original-Unicast-NPDU');

    const expectingReply = fieldRow(page, 'npdu-expecting-reply');
    await expect(expectingReply.getByTestId('decode-field-raw')).toContainText('1');

    const pduType = fieldRow(page, 'apdu-pdu-type');
    await expect(pduType.getByTestId('decode-field-physical')).toHaveText('BACnet-Confirmed-Request-PDU');

    const serviceChoice = fieldRow(page, 'apdu-service-choice');
    await expect(serviceChoice.getByTestId('decode-field-physical')).toHaveText('ReadProperty');

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Original-Broadcast-NPDU / I-Am örneği Invoke ID olmadan doğru basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('original-broadcast-npdu-i-am');

    const bvlcFunction = fieldRow(page, 'bvlc-function');
    await expect(bvlcFunction.getByTestId('decode-field-physical')).toHaveText('Original-Broadcast-NPDU');

    const serviceChoice = fieldRow(page, 'apdu-service-choice');
    await expect(serviceChoice.getByTestId('decode-field-physical')).toHaveText('I-Am');
    await expect(fieldRow(page, 'apdu-invoke-id')).toHaveCount(0);

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Forwarded-NPDU örneği B/IP adresini NPDU’dan önce basar, NPDU sonrasında doğru çözülür', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('forwarded-npdu');

    const address = fieldRow(page, 'bvlc-originating-address');
    await expect(address.getByTestId('decode-field-physical')).toHaveText('192.168.1.50:47808');

    const serviceChoice = fieldRow(page, 'apdu-service-choice');
    await expect(serviceChoice.getByTestId('decode-field-physical')).toHaveText('I-Am');

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Register-Foreign-Device örneği yalnız ad + ham gövde basar (BBMD/FDT takibi yok), uyarı ile', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('register-foreign-device');

    const bvlcFunction = fieldRow(page, 'bvlc-function');
    await expect(bvlcFunction.getByTestId('decode-field-physical')).toHaveText('Register-Foreign-Device');

    await expect(fieldRow(page, 'bvlc-function-body')).toHaveCount(1);
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      tr['protocol.bacnetIp.warning.functionBodyNotDecoded'],
    );
    // Yalnız uyarı — yapısal olarak yine geçerli, çerçeve hatası basılmaz.
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('BVLC-Result örneği dar ad + ham gövde basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('bvlc-result');

    const bvlcFunction = fieldRow(page, 'bvlc-function');
    await expect(bvlcFunction.getByTestId('decode-field-physical')).toHaveText('BVLC-Result');
    await expect(fieldRow(page, 'bvlc-function-body')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Length tutarsızlığı yalnız uyarı üretir, çerçeve hatası basılmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('length-mismatch');

    const length = fieldRow(page, 'bvlc-length');
    await expect(length).toHaveAttribute('data-valid', 'false');
    // Sayfada İKİNCİ bir uyarı da vardır (apdu-service-parameters'ın hep-var
    // "not decoded" notu, dosya başı) — bu yüzden sayfa-geneli seçici DEĞİL,
    // `data-field-id`e göre SPESİFİK satır seçilir (strict-mode çakışması).
    await expect(page.locator('[data-testid="decode-field-warning"][data-field-id="bvlc-length"]')).toContainText(
      tr['protocol.bacnetIp.warning.lengthMismatch'],
    );
    // Length yanlış olsa da gerçek buffer TEK doğru kaynak sayılır — NPDU/APDU yine çözülür.
    const serviceChoice = fieldRow(page, 'apdu-service-choice');
    await expect(serviceChoice.getByTestId('decode-field-physical')).toHaveText('ReadProperty');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Type ≠ 0x81 gerçek bir çerçeve hatası basar (ParseFailure değil)', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('invalid-type');

    const type = fieldRow(page, 'bvlc-type');
    await expect(type).toHaveAttribute('data-valid', 'false');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).not.toHaveCount(0);
    // Type hatalı olsa da geri kalan alanlar (Service Choice dahil) yine yapısal olarak çözülür.
    const serviceChoice = fieldRow(page, 'apdu-service-choice');
    await expect(serviceChoice.getByTestId('decode-field-physical')).toHaveText('ReadProperty');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('BACnet/IP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('register-foreign-device');
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      translations.en['protocol.bacnetIp.warning.functionBodyNotDecoded'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('original-unicast-npdu-read-property');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
