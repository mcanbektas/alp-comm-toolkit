import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 6d'nin gerçek tarayıcı turu — DALI.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (building-automation/dali/dali) Hazır
 * rozetiyle açıldığı — 6a-6c'nin (DMX512/Art-Net/sACN) kamu kaynaklı üçlüsünden
 * sonra lisanslı IEC 62386 ailesine geçen ilk motor; Address Byte'ın üst
 * bitlerinden Individual/Group/Broadcast sınıfının, en düşük bitinden (Y/S)
 * DAPC/Command ayrımının doğru çözüldüğü; dar opcode ad kümesinin (OFF, Go To
 * Scene) doğru adlandığı; kümenin dışındaki opcode'un yalnız kategorisiyle
 * (ad UYDURULMADAN) ham gösterildiği; backward frame'in bağlam-bağımlılık
 * uyarısı bastığı; 3 baytlık DALI-2 device frame'in HATA değil "planned"
 * uyarısıyla ham gösterildiği; tanınmayan uzunluğun (4 bayt) gerçek bir parse
 * hatası kartı bastığı.
 *
 * DALI'nin alias sayfası YOK (katalog "Katalog yolları" tablosu) — alias
 * devralma testi burada yok. BEKÇİ BORCU yok (brief), ekstra iş gerekmedi.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/building-automation/dali/dali?tab=decode';

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

test.describe('DALI', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DALI');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'dali');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Individual adres + DAPC örneği arc power seviyesini basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('individual-dapc');

    const address = fieldRow(page, 'address');
    await expect(address.getByTestId('decode-field-physical')).toHaveText('Individual 5');
    await expect(address.getByTestId('decode-field-raw')).toHaveText('0xA (10)');

    const data = fieldRow(page, 'data');
    await expect(data.getByTestId('decode-field-select')).toHaveText('Direct Arc Power (DAPC)');
    await expect(data.getByTestId('decode-field-raw')).toHaveText('0xC8 (200)');
    await expect(data.getByTestId('decode-field-physical')).toHaveText('Direct Arc Power Level (Control)');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Individual adres + tanınan komut (OFF) doğru adlanır', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('individual-recognized-command-off');

    const data = fieldRow(page, 'data');
    await expect(data.getByTestId('decode-field-select')).toHaveText('Command');
    await expect(data.getByTestId('decode-field-physical')).toHaveText('OFF (Control)');
    await expect(data).toHaveAttribute('data-valid', 'true');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Group adres + komut örneği Go To Scene’i sahne numarasıyla basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('group-command');

    const address = fieldRow(page, 'address');
    await expect(address.getByTestId('decode-field-physical')).toHaveText('Group 3');
    const data = fieldRow(page, 'data');
    await expect(data.getByTestId('decode-field-physical')).toHaveText('Go To Scene 7 (Control)');
    await expectNoRawTranslationKeys(page);
  });

  test('Broadcast + komut örneği tüm cihazları hedefler', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('broadcast-command');

    const address = fieldRow(page, 'address');
    await expect(address.getByTestId('decode-field-physical')).toHaveText('Broadcast');
    const data = fieldRow(page, 'data');
    await expect(data.getByTestId('decode-field-physical')).toHaveText('OFF (Control)');
    await expectNoRawTranslationKeys(page);
  });

  test('dar kümenin dışındaki opcode yalnız kategorisiyle ham gösterilir, ad uydurulmaz', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unrecognized-opcode');

    const data = fieldRow(page, 'data');
    await expect(data).toHaveAttribute('data-valid', 'false');
    await expect(data.getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(data.getByTestId('decode-field-physical')).toHaveText('Control');
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      tr['protocol.dali.warning.unrecognizedOpcode'],
    );
    // Uyarı hata değildir: çerçeve yapısal olarak yine geçerli sayılır.
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('backward frame 8-bit yanıtı ham gösterir ve bağlam-bağımlılık uyarısı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('backward-frame-response');

    const response = fieldRow(page, 'response');
    await expect(response.getByTestId('decode-field-raw')).toHaveText('0xD2 (210)');
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      tr['protocol.dali.warning.backwardFrameContextDependent'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('3 baytlık DALI-2 device frame HATA değil "planned" uyarısıyla ham gösterilir', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('dali2-device-frame');

    const deviceFrame = fieldRow(page, 'dali2-device-frame');
    await expect(deviceFrame).toBeVisible();
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      tr['protocol.dali.warning.dali2DeviceFramePlanned'],
    );
    // Bilinçli kapsam dışı — HATA kartı basılmaz, yapısal olarak yine geçerli.
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan uzunluk (4 bayt) gerçek bir parse hatası kartı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unrecognized-length');

    const parseError = page.getByTestId('decode-parse-error');
    await expect(parseError).toBeVisible();
    await expect(parseError).toHaveAttribute('data-error-code', 'frame-too-long');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DALI');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('unrecognized-opcode');
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      translations.en['protocol.dali.warning.unrecognizedOpcode'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('dali2-device-frame');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
