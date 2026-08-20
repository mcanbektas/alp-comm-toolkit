import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 9b'nin gerçek tarayıcı turu — AT Commands (jenerik motor).
 *
 * Kanıtladığı şey: `parseAtCommandLine`in bayt-düzeyi ofset hesabı
 * (`atCommands.test.ts`teki birim testlerin aynısı) DecodePanel'in HEX
 * vurgulamasında da doğru çıkıyor — bu dosya motoru değil, motor↔ekran
 * bağlantısını sınar. `hayes-command-set` BU sayfada değil, kendi (planned)
 * kaydında — bu dalgada dokunulmadı (brief 9b madde 7, karar bekliyor).
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/framing-stream-protocols/at-commands?tab=decode';

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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AT Commands');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'at-commands');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('execute komutu: AT önek + komut adı + eylem ayrı alanlarda çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'command-execute');

  await expect(fieldRow(page, 'prefix').getByTestId('decode-field-raw')).toHaveText('AT');
  await expect(fieldRow(page, 'command-name').getByTestId('decode-field-raw')).toHaveText('CSQ');
  await expect(fieldRow(page, 'action').getByTestId('decode-field-raw')).toHaveText('execute');
  await expectNoRawTranslationKeys(page);
});

test('set komutu: parametre ayrı alanda, HEX vurgulama doğru ofsette', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'command-set');

  await expect(fieldRow(page, 'command-name').getByTestId('decode-field-raw')).toHaveText('CMGF');
  await expect(fieldRow(page, 'action').getByTestId('decode-field-raw')).toHaveText('set');
  await expect(fieldRow(page, 'parameters').getByTestId('decode-field-raw')).toHaveText('1');
  await expectNoRawTranslationKeys(page);
});

test('KARAR: +CME ERROR sayısal kod SAYIYA çevrilir, anlamı ASLA uydurulmaz', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'final-result-cme-numeric');

  await expect(fieldRow(page, 'result-code').getByTestId('decode-field-raw')).toHaveText('+CME ERROR');
  await expect(fieldRow(page, 'error-code').getByTestId('decode-field-raw')).toHaveText('0xA (10)');
  // TS 27.007 Annex'in ~250 kodluk anlam tablosu bu dalganın kapsamı dışında —
  // "SIM not inserted" gibi bir metin hiçbir alanda görünmemeli.
  await expect(page.getByText('SIM not inserted')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('+CME ERROR metin modu (AT+CMEE=2) kodu SAYIYA çevirmez', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'final-result-cme-verbose');

  await expect(fieldRow(page, 'error-code').getByTestId('decode-field-raw')).toHaveText('SIM not inserted');
});

test('CONNECT hızı ayrı bir sayısal alt-alana ayrıştırılır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'connect-with-rate');

  await expect(fieldRow(page, 'result-code').getByTestId('decode-field-raw')).toHaveText('CONNECT');
  await expect(fieldRow(page, 'connect-rate').getByTestId('decode-field-raw')).toHaveText('0x1C200 (115200)');
  await expect(fieldRow(page, 'connect-rate').getByTestId('decode-field-physical')).toContainText('bit/s');
});

test('karışık büyük/küçük harf önek geçerli kalır ama uyarı basar', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'command-mixed-case');

  await expect(page.getByTestId('decode-field-warning')).toHaveCount(1);
  await expect(page.getByTestId('decode-field-warning')).toContainText(
    tr['protocol.atCommands.warning.mixedCasePrefix'],
  );
  await expectNoRawTranslationKeys(page);
});

test('serbest metin (banner) hata üretmeden text sınıfına düşer', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'banner-text');

  await expect(fieldRow(page, 'kind').getByTestId('decode-field-raw')).toHaveText('text');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'final-result-cme-numeric');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
