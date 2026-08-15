import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 3a'nın gerçek tarayıcı turu — NMEA 2000.
 *
 * `j1939-decode.spec.ts`in izlediği desen: birim testler `DecodePanel`i sahte
 * bir eklentiyle jsdom'da koşturuyor, bu dosya `/comm/...?tab=decode` adresine
 * gidince motorun GERÇEKTEN indirildiğini ve identifier formülünün J1939 ile
 * BİREBİR AYNI sonucu ürettiğini (spec §14701 = §38503) ekranda kanıtlıyor.
 *
 * Alias sayfası bu dalgada YOK: NMEA 2000 kaydına `aliasOf` yönünde bakan başka
 * bir katalog kaydı yok (bkz. `related` alanları — hepsi `related`, `aliasOf` değil).
 */

const tr = translations.tr;

/** Kanonik ve tek kayıt: motor burada tanımlı. */
const CANONICAL_DECODE_PATH = '/comm/marine-navigation/nmea-family/nmea-2000?tab=decode';

/** J1939'un doğrulanmış §43 fixture'ı, aynı identifier formülüyle burada da geçerli. */
const FIXTURE_HEX = '01 04 F0 98 08 00 00 00 FF FF FF 68 13 FF FF FF';

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

async function openDecodePanel(page: Page, path: string): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
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

test('decode sekmesi gerçek panelle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('NMEA 2000');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'nmea-2000');
  await expect(page.getByTestId('decode-loading')).toHaveCount(0);
  await expect(page.getByTestId('decode-load-error')).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('J1939 ile paylaşılan identifier formülü aynı Priority/PGN/Source Address’i üretir', async ({
  page,
}) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.locator('#decode-hex')).toHaveValue(FIXTURE_HEX);
  await expect(page.getByTestId('decode-byte-count')).toContainText('16');

  await expect(page.getByTestId('decode-field-row')).toHaveCount(10);

  await expect(fieldRow(page, 'priority').getByTestId('decode-field-raw')).toHaveText('0x6 (6)');
  await expect(fieldRow(page, 'pgn').getByTestId('decode-field-raw')).toHaveText('0xF004 (61444)');
  await expect(fieldRow(page, 'source-address').getByTestId('decode-field-raw')).toHaveText(
    '0x1 (1)',
  );

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('PGN alanına isim atanmaz — pgnNeedsDatabase ve possibleJ1939 uyarıları her zaman basılır', async ({
  page,
}) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  // Fiziksel değer hücresi HER alan için basılır (boşsa em-dash gösterir); PGN'e
  // hiçbir zaman isim atanmadığı için burada hep boş kalır.
  await expect(fieldRow(page, 'pgn').getByTestId('decode-field-physical')).toHaveText('—');
  const warningTexts = await page.getByTestId('decode-frame-warning').allTextContents();
  expect(warningTexts.join(' | ')).toContain(tr['protocol.nmea.2000.warning.pgnNeedsDatabase']);
  expect(warningTexts.join(' | ')).toContain(tr['protocol.nmea.2000.warning.possibleJ1939']);
  await expectNoRawTranslationKeys(page);
});

test('fast-packet olabilecek örnekte fastPacketUnknown uyarısı basılır', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('fast-packet-candidate');

  const warningTexts = await page.getByTestId('decode-frame-warning').allTextContents();
  expect(warningTexts.join(' | ')).toContain(tr['protocol.nmea.2000.warning.fastPacketUnknown']);
  await expect(fieldRow(page, 'data')).toHaveCount(1);
  await expectNoRawTranslationKeys(page);
});

test('geniş PGN aralığı örneği (Data Page 1) yine ham PGN numarası basar', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('wide-pgn-range');

  await expect(fieldRow(page, 'data-page').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  // PGN 131071 = 0x1FFFF: dört hane yalnız ASGARİ dolgu, sayı beş haneye taşıyor.
  await expect(fieldRow(page, 'pgn').getByTestId('decode-field-raw')).toHaveText(
    '0x1FFFF (131071)',
  );
});

test('PDU1 örneğinde hedef adres alanı kendi sonucunu söyler', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('pdu1-destination-specific');

  await expect(fieldRow(page, 'pdu-format').getByTestId('decode-field-physical')).toHaveText(
    'PDU1',
  );
  await expect(fieldRow(page, 'pdu-specific').getByTestId('decode-field-raw')).toHaveText(
    '0x10 (16)',
  );
  await expect(fieldRow(page, 'pgn').getByTestId('decode-field-raw')).toHaveText('0xEA00 (59904)');
});

test('11-bit çerçeve hata basar ama çerçeve yine alan alan gösterilir', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('base-frame-rejected');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');

  await expect(fieldRow(page, 'pgn')).toHaveCount(0);
  await expect(fieldRow(page, 'can-id').getByTestId('decode-field-raw')).toHaveText('0x321 (801)');
  await expect(fieldRow(page, 'data')).toHaveCount(1);
  await expectNoRawTranslationKeys(page);
});

test('alan seçimi bayt görüntüleyicideki bölgeyi vurgular', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  const sourceRegion = page.locator('[data-region-id="source-address"]').first();
  await expect(sourceRegion).toHaveAttribute('data-selected', 'false');

  await fieldRow(page, 'source-address').getByTestId('decode-field-select').click();

  await expect(sourceRegion).toHaveAttribute('data-selected', 'true');
  await expect(fieldRow(page, 'source-address')).toHaveAttribute('data-selected', 'true');

  await sourceRegion.click();
  await expect(sourceRegion).toHaveAttribute('data-selected', 'false');
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page, CANONICAL_DECODE_PATH);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(
    0,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(
    0,
  );
});
