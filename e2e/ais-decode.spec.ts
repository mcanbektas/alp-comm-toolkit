import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 3b'nin gerçek tarayıcı turu — AIS.
 *
 * `nmea2000-decode.spec.ts`in izlediği desen: birim testler `DecodePanel`i sahte
 * bir eklentiyle jsdom'da koşturuyor, bu dosya `/comm/...?tab=decode` adresine
 * gidince motorun GERÇEKTEN indirildiğini ve zarf + Message Type çözümünün
 * ekranda göründüğünü kanıtlıyor.
 *
 * Alias sayfası bu dalgada YOK: `marine-navigation/ais/ais` tek kayıt, `related`
 * alanı yalnız NMEA 0183'e bakıyor (aliasOf değil).
 */

const tr = translations.tr;

/** Kanonik ve tek kayıt: motor burada tanımlı. */
const CANONICAL_DECODE_PATH = '/comm/marine-navigation/ais/ais?tab=decode';

/** İlk örnek çerçeve — `ais.ts`teki `position-report-class-a` ile BİREBİR aynı baytlar. */
const FIXTURE_HEX = '21 41 49 56 44 4D 2C 31 2C 31 2C 2C 41 2C 31 36 62 3F 77 2C 30 2A 30 42';

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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AIS');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ais');
  await expect(page.getByTestId('decode-loading')).toHaveCount(0);
  await expect(page.getByTestId('decode-load-error')).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('tek fragmentli örnekte zarf TAM ve Message Type 1 adlandırılmış çözülür', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.locator('#decode-hex')).toHaveValue(FIXTURE_HEX);
  // talker, sentence-formatter, fragment-count, fragment-number, sequence-message-id,
  // channel, message-type, remaining-payload, fill-bits, checksum.
  await expect(page.getByTestId('decode-field-row')).toHaveCount(10);

  await expect(fieldRow(page, 'talker').getByTestId('decode-field-raw')).toHaveText('AI');
  await expect(fieldRow(page, 'sentence-formatter').getByTestId('decode-field-raw')).toHaveText('VDM');
  await expect(fieldRow(page, 'fragment-count').getByTestId('decode-field-physical')).toHaveText('1');
  await expect(fieldRow(page, 'channel').getByTestId('decode-field-raw')).toHaveText('A');

  const messageTypeRow = fieldRow(page, 'message-type');
  // `message-type`in rawValue'su NUMBER (nmea2000'in `pgn` alanı emsali) — tablo
  // bunu hex+ondalık birlikte basıyor.
  await expect(messageTypeRow.getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  await expect(messageTypeRow.getByTestId('decode-field-physical')).toHaveText('Position Report Class A');

  const checksumRow = fieldRow(page, 'checksum');
  await expect(checksumRow.getByTestId('decode-field-validity')).toHaveText(tr['decode.status.valid']);
  await expect(checksumRow).toHaveAttribute('data-valid', 'true');

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('kalan bitler her zaman ham kalır — fieldsNeedDatabase uyarısı basılır', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  const warningTexts = await page.getByTestId('decode-frame-warning').allTextContents();
  expect(warningTexts.join(' | ')).toContain(tr['protocol.ais.warning.fieldsNeedDatabase']);
  await expect(fieldRow(page, 'remaining-payload').getByTestId('decode-field-raw')).toHaveText('—');
  await expectNoRawTranslationKeys(page);
});

test('çok parçalı örnekte fragmentedMessage uyarısı basılır, birleştirme YAPILMAZ', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('multi-fragment-static-data');

  await expect(fieldRow(page, 'fragment-count').getByTestId('decode-field-physical')).toHaveText('2');
  await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText(
    'Static and Voyage Data',
  );

  const warningTexts = await page.getByTestId('decode-frame-warning').allTextContents();
  expect(warningTexts.join(' | ')).toContain(tr['protocol.ais.warning.fragmentedMessage']);
  await expectNoRawTranslationKeys(page);
});

test('spec’te adı olmayan Message Type ham numara + uyarı basar', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('unnamed-message-type');

  const messageTypeRow = fieldRow(page, 'message-type');
  await expect(messageTypeRow.getByTestId('decode-field-raw')).toHaveText('0x8 (8)');
  await expect(messageTypeRow.getByTestId('decode-field-physical')).toHaveText('—');

  const warningTexts = await page.getByTestId('decode-frame-warning').allTextContents();
  expect(warningTexts.join(' | ')).toContain(tr['protocol.ais.warning.messageTypeNeedsDatabase']);
  await expectNoRawTranslationKeys(page);
});

test('bozuk checksum örneği hata basar ama Message Type yine çözülür', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('checksum-mismatch');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-validity')).toHaveText(
    tr['decode.status.invalid'],
  );

  // ...ama çerçeve YİNE alan alan çözülmüş olmalı (spec §47).
  await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText(
    'Position Report Class A',
  );
  await expectNoRawTranslationKeys(page);
});

test('AIVDO örneğinde own-vessel formatörü ve Message Type 18 çözülür', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('own-vessel-class-b');

  await expect(fieldRow(page, 'sentence-formatter').getByTestId('decode-field-raw')).toHaveText('VDO');
  await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText(
    'Class B Position Report',
  );
  await expectNoRawTranslationKeys(page);
});

test('alan seçimi bayt görüntüleyicideki bölgeyi vurgular', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  const messageTypeRegion = page.locator('[data-region-id="message-type"]').first();
  await expect(messageTypeRegion).toHaveAttribute('data-selected', 'false');

  await fieldRow(page, 'message-type').getByTestId('decode-field-select').click();

  await expect(messageTypeRegion).toHaveAttribute('data-selected', 'true');
  await expect(fieldRow(page, 'message-type')).toHaveAttribute('data-selected', 'true');

  await messageTypeRegion.click();
  await expect(messageTypeRegion).toHaveAttribute('data-selected', 'false');
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
