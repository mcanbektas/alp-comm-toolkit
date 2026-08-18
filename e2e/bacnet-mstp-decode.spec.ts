import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 6f'nin gerçek tarayıcı turu — BACnet MS/TP.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (building-automation/bacnet/bacnet-mstp)
 * Hazır rozetiyle açıldığı; Length=0 çerçevelerde Data CRC alanının HİÇ
 * basılmadığı; paylaşılan NPDU/APDU çekirdeğinin (npdu.ts/apdu.ts) alanları
 * bu motorun kendi alanlarıyla (frameType/destinationMac/sourceMac) birlikte
 * doğru göründüğü; Destination MAC'in Device Instance ile KARIŞTIRILMADIĞI;
 * bozuk Header CRC'nin ve bozuk Data CRC'nin ikisinin de gerçek bir çerçeve
 * hatası (frame-level error, ParseFailure DEĞİL) ürettiği; tanınmayan Frame
 * Type'ın yalnız uyarı ürettiği.
 *
 * BACnet MS/TP'nin alias sayfası YOK (katalog "Katalog yolları" tablosu) —
 * alias devralma testi burada yok. BEKÇİ BORCU yok (brief), ekstra iş
 * gerekmedi.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/building-automation/bacnet/bacnet-mstp?tab=decode';

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

test.describe('BACnet MS/TP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('BACnet MS/TP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'bacnet-mstp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Token örneği Length=0 yolunu basar, Data CRC alanı hiç görünmez', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('token');

    const frameType = fieldRow(page, 'frameType');
    await expect(frameType.getByTestId('decode-field-physical')).toHaveText('Token');

    await expect(fieldRow(page, 'dataCrc')).toHaveCount(0);
    await expect(fieldRow(page, 'data')).toHaveCount(0);

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Data Expecting Reply / ReadProperty örneği NPDU + APDU başlığını doğru basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('data-expecting-reply-read-property');

    const expectingReply = fieldRow(page, 'npdu-expecting-reply');
    await expect(expectingReply.getByTestId('decode-field-raw')).toContainText('1');

    const pduType = fieldRow(page, 'apdu-pdu-type');
    await expect(pduType.getByTestId('decode-field-physical')).toHaveText('BACnet-Confirmed-Request-PDU');

    const invokeId = fieldRow(page, 'apdu-invoke-id');
    await expect(invokeId.getByTestId('decode-field-raw')).toContainText('1');

    const serviceChoice = fieldRow(page, 'apdu-service-choice');
    await expect(serviceChoice.getByTestId('decode-field-physical')).toHaveText('ReadProperty');

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Data Not Expecting Reply / I-Am örneği broadcast MAC’i Device Instance ile karıştırmadan basar', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('data-not-expecting-reply-i-am');

    const destinationMac = fieldRow(page, 'destinationMac');
    await expect(destinationMac.getByTestId('decode-field-raw')).toContainText('0xFF');

    const pduType = fieldRow(page, 'apdu-pdu-type');
    await expect(pduType.getByTestId('decode-field-physical')).toHaveText('BACnet-Unconfirmed-Request-PDU');

    const serviceChoice = fieldRow(page, 'apdu-service-choice');
    await expect(serviceChoice.getByTestId('decode-field-physical')).toHaveText('I-Am');

    // Unconfirmed-Request'te Invoke ID YOKTUR.
    await expect(fieldRow(page, 'apdu-invoke-id')).toHaveCount(0);

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('bozuk Header CRC gerçek bir çerçeve hatası basar (ParseFailure değil)', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('bad-header-crc');

    const headerCrc = fieldRow(page, 'headerCrc');
    await expect(headerCrc).toHaveAttribute('data-valid', 'false');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).not.toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('bozuk Data CRC yalnız Data CRC alanını geçersiz kılar, NPDU/APDU yine çözülür', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('bad-data-crc');

    const headerCrc = fieldRow(page, 'headerCrc');
    await expect(headerCrc).toHaveAttribute('data-valid', 'true');

    const dataCrc = fieldRow(page, 'dataCrc');
    await expect(dataCrc).toHaveAttribute('data-valid', 'false');

    const serviceChoice = fieldRow(page, 'apdu-service-choice');
    await expect(serviceChoice.getByTestId('decode-field-physical')).toHaveText('I-Am');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).not.toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan Frame Type yalnız uyarı üretir, Data ham blok gösterilir', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unrecognized-frame-type');

    const frameType = fieldRow(page, 'frameType');
    await expect(frameType).toHaveAttribute('data-valid', 'false');
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      tr['protocol.bacnetMstp.warning.unknownFrameType'],
    );

    await expect(fieldRow(page, 'data')).toHaveCount(1);
    // Yalnız uyarı — yapısal olarak yine geçerli, çerçeve hatası basılmaz.
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('BACnet MS/TP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('unrecognized-frame-type');
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      translations.en['protocol.bacnetMstp.warning.unknownFrameType'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('data-expecting-reply-read-property');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
