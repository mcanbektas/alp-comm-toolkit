import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 6e'nin gerçek tarayıcı turu — KNX.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (building-automation/knx/knx) Hazır
 * rozetiyle açıldığı — dali.ts'ten (6d) sonra lisanslı KNX Standard/ISO 22510
 * ailesine geçen ikinci motor; Destination Address'in AT bitine göre İKİ AYRI
 * formatta (`a/b/c` Group / `a.b.c` Individual) doğru gösterildiği; dar APCI
 * ad kümesinin (GroupValueRead/Write/Response) doğru adlandığı; kümenin
 * dışındaki APCI'nin ad UYDURULMADAN ham gösterildiği; DPT'siz payload'ın
 * "raw uintN" tonuyla (katalog yorumu) basıldığı; Extended frame'in HATA
 * değil "kapsam dışı" uyarısıyla ham gösterildiği; bozuk checksum'ın gerçek
 * bir çerçeve hatası (frame-level error, ParseFailure DEĞİL) ürettiği.
 *
 * KNX'in alias sayfası YOK (katalog "Katalog yolları" tablosu) — alias
 * devralma testi burada yok. BEKÇİ BORCU yok (brief), ekstra iş gerekmedi.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/building-automation/knx/knx?tab=decode';

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

test.describe('KNX', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('KNX');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'knx');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('GroupValueWrite örneği Group adresi ve inline değeri doğru basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('group-value-write');

    const destination = fieldRow(page, 'destinationAddress');
    await expect(destination.getByTestId('decode-field-physical')).toHaveText('2/1/5');

    const apci = fieldRow(page, 'apciService');
    await expect(apci.getByTestId('decode-field-physical')).toHaveText('GroupValueWrite');

    const payload = fieldRow(page, 'payload');
    await expect(payload.getByTestId('decode-field-raw')).toHaveText('0x1 (1)');

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('GroupValueRead örneği payload’suz sorguyu doğru adlar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('group-value-read');

    const apci = fieldRow(page, 'apciService');
    await expect(apci.getByTestId('decode-field-physical')).toHaveText('GroupValueRead');
    const priority = fieldRow(page, 'priority');
    await expect(priority.getByTestId('decode-field-physical')).toHaveText('Alarm');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('GroupValueResponse örneği katalog yorumunun "raw uint16: 100" tonuyla basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('group-value-response');

    const payload = fieldRow(page, 'payload');
    await expect(payload.getByTestId('decode-field-physical')).toContainText('raw uint16: 100');
    await expect(payload.getByTestId('decode-field-physical')).toContainText('DPT unknown');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Individual adres hedefli örnek `a.b.c` formatını basar, `a/b/c` ile karışmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('individual-address-destination');

    const destination = fieldRow(page, 'destinationAddress');
    await expect(destination.getByTestId('decode-field-physical')).toHaveText('4.2.100');
    const addressType = fieldRow(page, 'addressType');
    await expect(addressType.getByTestId('decode-field-physical')).toHaveText('Individual');
    const priority = fieldRow(page, 'priority');
    await expect(priority.getByTestId('decode-field-physical')).toHaveText('System');
    await expectNoRawTranslationKeys(page);
  });

  test('Extended frame HATA değil "kapsam dışı" uyarısıyla ham gösterilir', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('extended-frame');

    const frameType = fieldRow(page, 'frameType');
    await expect(frameType.getByTestId('decode-field-physical')).toHaveText('Extended');
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      tr['protocol.knx.warning.extendedFrameOutOfScope'],
    );
    // Bilinçli kapsam dışı — HATA kartı basılmaz, yapısal olarak yine geçerli.
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('dar kümenin dışındaki APCI yalnız ham gösterilir, ad uydurulmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unrecognized-apci');

    const apci = fieldRow(page, 'apciService');
    await expect(apci).toHaveAttribute('data-valid', 'false');
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      tr['protocol.knx.warning.unrecognizedApci'],
    );
    // Uyarı hata değildir: çerçeve yapısal olarak yine geçerli sayılır.
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('bozuk checksum gerçek bir çerçeve hatası basar (ParseFailure değil)', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('checksum-mismatch');

    const checksum = fieldRow(page, 'checksum');
    await expect(checksum).toHaveAttribute('data-valid', 'false');
    // checksum-mismatch bir ParseFailure DEĞİL — çerçeve yine kuruldu, yalnız valid:false.
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).not.toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('KNX');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('unrecognized-apci');
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      translations.en['protocol.knx.warning.unrecognizedApci'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('group-value-response');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
