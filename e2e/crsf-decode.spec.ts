import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 15d'nin gerçek tarayıcı turu — CRSF.
 *
 * Kanıtladığı şey: `packedChannels.ts`in `lsb-first` sırasının VE protokolce
 * tanımlı `TICKS_TO_US` dönüşümünün GERÇEKTEN kullanıcının gördüğü ekrana
 * kadar doğru taşındığı; Frame CRC ile Command CRC'nin AYRI satırlarda, AYRI
 * PASS/FAIL gösterildiği (brif madde 7 — tek "CRC PASS" göstergesine
 * indirgenmediği); `0x17`nin ham + satıcı-önermiyor uyarısıyla kaldığı;
 * `sbus-decode.spec.ts`/`ibus-decode.spec.ts` emsali.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/aerospace-uav/rc-control-links/crsf?tab=decode';

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  // `/comm/` öneki ZORUNLU: `vite.config.ts` base'i `/comm/` yapıyor.
  await page.goto(DECODE_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

/** Devralınan tuzak: alan uyarısı ayrı `<tr>`de basılır, kökten `[data-field-id]` ile aranır. */
function fieldWarnings(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

/** Hiçbir tanı satırı ham çeviri anahtarı basmamalı (dalga 1'de görülen kusur). */
async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CRSF');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'crsf');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('rc-channels-packed örneği 16 kanalın tümünü lsb-first sırayla VE protokolce tanımlı µs değerini doğru çözer', async ({
  page,
}) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('rc-channels-packed');

  // Beklenen: kanal i = i×100 (0, 100, …, 1500) — packedChannels.test.ts'teki
  // fixture'la AYNI. Yanlış bit sırası (msb-first) bu değerleri ÜRETMEZ.
  await expect(fieldRow(page, 'crsf-channel-0').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
  await expect(fieldRow(page, 'crsf-channel-1').getByTestId('decode-field-raw')).toHaveText('0x64 (100)');
  await expect(fieldRow(page, 'crsf-channel-15').getByTestId('decode-field-raw')).toHaveText('0x5DC (1500)');

  // Türetilmiş µs — TICKS_TO_US(x) = (x-992)*5/8+1500, C'nin sıfıra-doğru
  // bölmesiyle (crsf.test.ts'teki trunc/floor kanıtıyla AYNI değerler).
  await expect(fieldRow(page, 'crsf-channel-0-us').getByTestId('decode-field-physical')).toHaveText('880 µs');
  await expect(fieldRow(page, 'crsf-channel-1-us').getByTestId('decode-field-physical')).toHaveText('943 µs');
  await expect(fieldRow(page, 'crsf-channel-15-us').getByTestId('decode-field-physical')).toHaveText('1817 µs');

  await expect(fieldRow(page, 'address').getByTestId('decode-field-physical')).toHaveText('Flight Controller');
  await expect(fieldRow(page, 'type').getByTestId('decode-field-physical')).toHaveText('RC Channels Packed');
  await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toHaveText('PASS');

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('subset-rc-channels-packed (0x17) örneği: payload HAM kalır, İKİ uyarı da görünür, Frame CRC yine PASS eder', async ({
  page,
}) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('subset-rc-channels-packed');

  await expect(fieldRow(page, 'type').getByTestId('decode-field-physical')).toHaveText(
    'Subset RC Channels Packed',
  );
  // Payload alanının KENDİ satırında İKİ uyarı: payload-not-decoded VE
  // vendor-discouraged — kökten `[data-field-id="payload"]` ile aranır
  // (devralınan tuzak: `fieldRow(...).getByTestId(...)` BOŞ döner).
  await expect(fieldWarnings(page, 'payload')).toHaveCount(2);

  await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  // Çerçeve uyarısı birden çoksa strict-mode ihlali verir — `.filter` ile süz
  // (devralınan tuzak).
  await expect(
    page.getByTestId('decode-frame-warning').filter({ hasText: tr['protocol.crsf.warning.frameTypeDiscouragedByVendor'] }),
  ).toHaveCount(1);
  await expect(
    page.getByTestId('decode-frame-warning').filter({ hasText: tr['protocol.crsf.warning.payloadNotDecodedForFrameType'] }),
  ).toHaveCount(1);
  await expectNoRawTranslationKeys(page);
});

test('battery-sensor (0x08) örneği: tip adlandırılır, payload HAM, satıcı uyarısı YOK', async ({ page }) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('battery-sensor');

  await expect(fieldRow(page, 'type').getByTestId('decode-field-physical')).toHaveText('Battery');
  await expect(fieldWarnings(page, 'payload')).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('device-ping (0x28) örneği: Destination/Origin AYRI alanlar olarak adlandırılır', async ({ page }) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('device-ping');

  await expect(fieldRow(page, 'destination').getByTestId('decode-field-physical')).toHaveText('Broadcast');
  await expect(fieldRow(page, 'origin').getByTestId('decode-field-physical')).toHaveText('Radio Transmitter');
  await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('command (0x32) örneği: Command CRC ve Frame CRC AYRI satırlarda, ikisi de PASS eder', async ({ page }) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('command');

  await expect(fieldRow(page, 'destination').getByTestId('decode-field-physical')).toHaveText('CRSF Receiver');
  await expect(fieldRow(page, 'origin').getByTestId('decode-field-physical')).toHaveText('Radio Transmitter');
  await expect(fieldRow(page, 'command-crc').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('command-crc-mismatch örneği: Command CRC FAIL eder, Frame CRC YİNE PASS eder — tek göstergeye İNDİRGENMEZ', async ({
  page,
}) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('command-crc-mismatch');

  await expect(fieldRow(page, 'command-crc').getByTestId('decode-field-physical')).toHaveText('FAIL');
  await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toHaveText('PASS');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'crc-mismatch');
  await expectNoRawTranslationKeys(page);
});

test('unrecognized-address örneği decode-frame-error basar, ama kanallar yine gösterilir', async ({ page }) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('unrecognized-address');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'start-delimiter-not-found');
  // Hatalı adrese rağmen kanal alanları yine basılır (spec §47).
  await expect(fieldRow(page, 'crsf-channel-0').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
  await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expectNoRawTranslationKeys(page);
});

test('frame-crc-mismatch örneği decode-frame-error basar', async ({ page }) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('frame-crc-mismatch');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'crc-mismatch');
  await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toHaveText('FAIL');
});

test('decode-options formu görünür ve baudProfile şıklarını sunar (çerçeveyi ETKİLEMEZ, dosya başı)', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(page.getByTestId('decode-options')).toBeVisible();
  const baudSelect = page.getByLabel(tr['protocol.crsf.option.baudProfile']);
  await expect(baudSelect).toBeVisible();

  await page.getByLabel(tr['decode.example.label']).selectOption('rc-channels-packed');
  await expect(fieldRow(page, 'crsf-channel-0').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');

  // Profil değişse de kanal DEĞERLERİ AYNI kalır — yalnız timing görünümünü
  // etkiler, çerçeveyi DEĞİL (crsf.ts dosya başı).
  await baudSelect.selectOption('fcCompatibility');
  await expect(fieldRow(page, 'crsf-channel-0').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
  await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toHaveText('PASS');
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
