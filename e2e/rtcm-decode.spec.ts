import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 3c'nin gerçek tarayıcı turu — RTCM.
 *
 * Kanıtladığı iki şey:
 *   1. Elle inşa edilen 1005 (Reference Station) örneği ekranda gerçekten
 *      Preamble/Length/Message Number/CRC-24Q olarak çözülüyor; mesaj ADI değil
 *      yalnız spec'in verdiği KATEGORİ ("Reference Station") basılıyor.
 *   2. Kanonik kayıt `marine-navigation/gnss-corrections/rtcm`; alias sayfaları
 *      (`interfaces-framing/framing-stream-protocols/rtcm` ve
 *      `aerospace-uav/gnss-navigation/rtcm`) AYNI motoru ve "Hazır" rozetini
 *      kanonik kayıttan devralıyor (j1939-decode.spec.ts'teki marine alias
 *      testi emsal — burada üç domain'e yayılan zincir doğrulanıyor).
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/marine-navigation/gnss-corrections/rtcm?tab=decode';
const INTERFACES_ALIAS_DECODE_PATH =
  '/comm/interfaces-framing/framing-stream-protocols/rtcm?tab=decode';
const AEROSPACE_ALIAS_DECODE_PATH = '/comm/aerospace-uav/gnss-navigation/rtcm?tab=decode';

const REFERENCE_STATION_HEX = 'D3 00 05 3E D0 00 00 00 99 6E 27';

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
  const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('RTCM');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'rtcm');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('mesaj 1005 örneği Reference Station kategorisini basar, mesaj adı YAZMAZ', async ({
  page,
}) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.locator('#decode-hex')).toHaveValue(REFERENCE_STATION_HEX);
  await expect(page.getByTestId('decode-byte-count')).toContainText('11');

  await expect(fieldRow(page, 'preamble').getByTestId('decode-field-raw')).toHaveText(
    '0xD3 (211)',
  );
  await expect(fieldRow(page, 'length').getByTestId('decode-field-raw')).toHaveText('0x5 (5)');
  await expect(fieldRow(page, 'message-number').getByTestId('decode-field-raw')).toHaveText(
    '0x3ED (1005)',
  );
  await expect(fieldRow(page, 'message-number').getByTestId('decode-field-physical')).toHaveText(
    'Reference Station',
  );
  await expect(fieldRow(page, 'crc').getByTestId('decode-field-physical')).toHaveText('Valid');

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('kategorisi belirsiz mesaj numarası uyarı basar, çerçeve yine geçerli sayılır', async ({
  page,
}) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('unclassified-message-number');

  await expect(fieldRow(page, 'message-number').getByTestId('decode-field-raw')).toHaveText(
    '0xFFF (4095)',
  );
  await expect(fieldRow(page, 'message-number').getByTestId('decode-field-validity')).toHaveText(
    tr['decode.status.invalid'],
  );
  // Bu örnekte İKİ çerçeve uyarısı birlikte basılır: payloadNeedsDatabase (her
  // dolu payload'da) + messageCategoryUnknown (bu örneğe özgü) — strict mode
  // tekil eşleşme istediği için metinler toplu okunur.
  const warningTexts = await page.getByTestId('decode-frame-warning').allTextContents();
  expect(
    warningTexts.some((text) => text.includes(tr['protocol.rtcm.warning.messageCategoryUnknown'])),
  ).toBe(true);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('bozuk CRC hata basar ama çerçeve yine alan alan gösterilir', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('crc-mismatch');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'crc-mismatch');
  await expect(fieldRow(page, 'message-number').getByTestId('decode-field-raw')).toHaveText(
    '0x3ED (1005)',
  );
  await expect(fieldRow(page, 'crc').getByTestId('decode-field-validity')).toHaveText(
    tr['decode.status.invalid'],
  );
  await expectNoRawTranslationKeys(page);
});

test('interfaces-framing alias sayfası aynı motoru ve Hazır rozetini devralır', async ({
  page,
}) => {
  const consoleErrors = await openDecodePanel(page, INTERFACES_ALIAS_DECODE_PATH);

  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'rtcm');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: tr['protocol.canonical'] })).toBeVisible();

  await expect(page.locator('#decode-hex')).toHaveValue(REFERENCE_STATION_HEX);
  await expect(fieldRow(page, 'message-number').getByTestId('decode-field-physical')).toHaveText(
    'Reference Station',
  );

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('aerospace-uav alias sayfası aynı motoru ve Hazır rozetini devralır', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page, AEROSPACE_ALIAS_DECODE_PATH);

  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'rtcm');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: tr['protocol.canonical'] })).toBeVisible();

  await expect(page.locator('#decode-hex')).toHaveValue(REFERENCE_STATION_HEX);
  await expect(fieldRow(page, 'message-number').getByTestId('decode-field-physical')).toHaveText(
    'Reference Station',
  );

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page, CANONICAL_DECODE_PATH);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
