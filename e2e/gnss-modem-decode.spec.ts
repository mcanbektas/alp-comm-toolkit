import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 9e'nin gerçek tarayıcı turu — GNSS Modem.
 *
 * Kanıtladığı şey: `gnssModemParser`in İKİ ayrı motora (`lteModemAtParser` +
 * `nmea0183Parser`) bağımlı bileşimi gerçekten çalışıyor — AT+QGPSGNMEA'nın
 * gömülü NMEA cümlesi nmea-0183 motoruyla çözülüyor VE ofsetleri DIŞ AT
 * satırına doğru kaydırılmış görünüyor (rebase doğrulaması, `checksum`
 * alanının HEX ofseti), AT+QGPSLOC dar alan kümesiyle (fix/lat/lon/alt/
 * sat/hdop) çözülüyor.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/wireless-iot/cellular-iot/gnss-modem?tab=decode';

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  await page.goto(CANONICAL_DECODE_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
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

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

test('decode sekmesi Hazır rozetiyle açılır, konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('GNSS Modem');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'gnss-modem');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('AT+QGPSLOC: dar alan kümesi doğru ofsette çözülür (Quectel kılavuzunun kendi örneği)', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'qgpsloc-2d-fix');

  await expect(fieldRow(page, 'latitude').getByTestId('decode-field-raw')).toHaveText('3150.7223N');
  await expect(fieldRow(page, 'latitude').getByTestId('decode-field-physical')).toContainText('31.845372');
  await expect(fieldRow(page, 'longitude').getByTestId('decode-field-physical')).toContainText('117.198822');
  await expect(fieldRow(page, 'hdop').getByTestId('decode-field-physical')).toHaveText('0.7');
  await expect(fieldRow(page, 'altitude').getByTestId('decode-field-physical')).toContainText('62.2');
  await expect(fieldRow(page, 'gnss-fix-type').getByTestId('decode-field-physical')).toContainText('2D fix');
  await expect(fieldRow(page, 'satellite-count').getByTestId('decode-field-physical')).toHaveText('9');
  await expectNoRawTranslationKeys(page);
});

test('AT+QGPSLOC: tanınmayan <fix> (Quectel yalnız 2/3 tanımlıyor) uyarı basar', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'qgpsloc-unrecognized-fix');

  await expect(fieldWarning(page, 'gnss-fix-type')).toContainText(
    tr['protocol.gnssModem.warning.fixTypeUnrecognized'],
  );
});

test('AT+QGPSGNMEA (GGA): gömülü cümle nmea-0183 motoruyla çözülür, HEX ofseti DIŞ satıra doğru kaydırılır', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'qgpsgnmea-gga');

  await expect(fieldRow(page, 'talker').getByTestId('decode-field-raw')).toHaveText('GP');
  await expect(fieldRow(page, 'sentence-formatter').getByTestId('decode-field-raw')).toHaveText('GGA');
  await expect(fieldRow(page, 'fix-quality').getByTestId('decode-field-physical')).toContainText('GPS Fix');
  await expect(fieldRow(page, 'latitude').getByTestId('decode-field-physical')).toContainText('31.8453');
  await expect(fieldRow(page, 'altitude').getByTestId('decode-field-physical')).toContainText('59.8');

  // Rebase doğrulaması: checksum HEX görünümünde DOĞRU ofsette (satırın
  // SONUNA yakın) vurgulanmalı — nmea0183Parser'ın kendi (yalnız cümle)
  // tamponuna göre 0-tabanlı ürettiği ofset burada YANLIŞ olsaydı bu alan
  // ya satırın BAŞINDA vurgulanırdı ya da hiç eşleşmezdi.
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-raw')).toHaveText('77');
  await expectNoRawTranslationKeys(page);
});

test('AT+QGPSGNMEA (RMC): farklı cümle tipi de aynı yoldan geçer (motor tekrar yazılmadı)', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'qgpsgnmea-rmc');

  await expect(fieldRow(page, 'sentence-formatter').getByTestId('decode-field-raw')).toHaveText('RMC');
  await expect(fieldRow(page, 'status').getByTestId('decode-field-physical')).toContainText('Active');
});

test('AT+QGPSGNMEA: bozuk gömülü cümle AT katmanı alanlarını SİLMEZ, uyarı basar', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'qgpsgnmea-malformed');

  await expect(fieldRow(page, 'prefix').getByTestId('decode-field-raw')).toHaveText('+QGPSGNMEA');
  await expect(fieldRow(page, 'latitude')).toHaveCount(0);
  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.gnssModem.warning.embeddedNmeaUnparseable'],
  );
  await expectNoRawTranslationKeys(page);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'qgpsgnmea-gga');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
