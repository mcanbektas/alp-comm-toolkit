import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 3c'nin gerçek tarayıcı turu — UBX.
 *
 * Kanıtladığı iki şey:
 *   1. Spec'in TEK somut UBX bayt dizisi (~5355: B5 62 0A 06 00 00 10 3A)
 *      ekranda gerçekten Class MON, ID 0x06 ve geçerli checksum olarak çözülüyor.
 *   2. Kanonik kayıt `marine-navigation/gnss-corrections/gnss-ubx`; alias
 *      sayfaları (`interfaces-framing/framing-stream-protocols/ubx` ve
 *      `aerospace-uav/gnss-navigation/gps-ubx`) AYNI motoru ve "Hazır" rozetini
 *      kanonik kayıttan devralıyor (j1939-decode.spec.ts'teki marine alias
 *      testi emsal — burada üç domain'e yayılan zincir doğrulanıyor).
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/marine-navigation/gnss-corrections/gnss-ubx?tab=decode';
const INTERFACES_ALIAS_DECODE_PATH =
  '/comm/interfaces-framing/framing-stream-protocols/ubx?tab=decode';
const AEROSPACE_ALIAS_DECODE_PATH = '/comm/aerospace-uav/gnss-navigation/gps-ubx?tab=decode';

const SPEC_FIXTURE_HEX = 'B5 62 0A 06 00 00 10 3A';

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

  // Başlık katalog sayfasının adı ("GNSS UBX"); eklentinin `PROTOCOL_DISPLAY_NAME`ı
  // ("UBX") yalnız decode panelinin kendi başlığında görünür.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('GNSS UBX');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'gnss-ubx');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('spec ~5355 fixture’ı Class MON, ID 0x06 ve geçerli checksum basar', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.locator('#decode-hex')).toHaveValue(SPEC_FIXTURE_HEX);
  await expect(page.getByTestId('decode-byte-count')).toContainText('8');

  await expect(fieldRow(page, 'class').getByTestId('decode-field-raw')).toHaveText('0xA (10)');
  await expect(fieldRow(page, 'class').getByTestId('decode-field-physical')).toHaveText('MON');
  await expect(fieldRow(page, 'message-id').getByTestId('decode-field-raw')).toHaveText('0x6 (6)');
  await expect(fieldRow(page, 'length').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('Valid');
  await expect(fieldRow(page, 'payload')).toHaveCount(0);

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('dolu payload örneği NAV class’ı adlandırır, payload’ı ham bırakıp uyarır', async ({
  page,
}) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('payload-needs-database');

  await expect(fieldRow(page, 'class').getByTestId('decode-field-physical')).toHaveText('NAV');
  await expect(fieldRow(page, 'payload')).toHaveCount(1);
  await expect(page.getByTestId('decode-field-warning')).toContainText(
    tr['protocol.ubx.warning.payloadNeedsDatabase'],
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('tanınmayan class hata değil uyarı basar, çerçeve yine geçerli sayılır', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('unknown-class');

  await expect(fieldRow(page, 'class').getByTestId('decode-field-validity')).toHaveText(
    tr['decode.status.invalid'],
  );
  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.ubx.warning.unknownClass'],
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('bozuk checksum hata basar ama çerçeve yine alan alan gösterilir', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('checksum-mismatch');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
  await expect(fieldRow(page, 'class').getByTestId('decode-field-raw')).toHaveText('0xA (10)');
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-validity')).toHaveText(
    tr['decode.status.invalid'],
  );
  await expectNoRawTranslationKeys(page);
});

test('interfaces-framing alias sayfası aynı motoru ve Hazır rozetini devralır', async ({
  page,
}) => {
  const consoleErrors = await openDecodePanel(page, INTERFACES_ALIAS_DECODE_PATH);

  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'gnss-ubx');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: tr['protocol.canonical'] })).toBeVisible();

  await expect(page.locator('#decode-hex')).toHaveValue(SPEC_FIXTURE_HEX);
  await expect(fieldRow(page, 'class').getByTestId('decode-field-physical')).toHaveText('MON');

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('aerospace-uav alias sayfası aynı motoru ve Hazır rozetini devralır', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page, AEROSPACE_ALIAS_DECODE_PATH);

  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'gnss-ubx');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: tr['protocol.canonical'] })).toBeVisible();

  await expect(page.locator('#decode-hex')).toHaveValue(SPEC_FIXTURE_HEX);
  await expect(fieldRow(page, 'class').getByTestId('decode-field-physical')).toHaveText('MON');

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
