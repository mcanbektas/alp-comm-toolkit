import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 15c'nin gerçek tarayıcı turu — SBUS.
 *
 * Kanıtladığı şey: `packedChannels.ts`in `lsb-first` sırasının GERÇEKTEN
 * kullanıcının gördüğü ekrana kadar doğru taşındığı (birim testler motoru
 * izole kanıtladı, burada uçtan uca), 16 kanalın tamamının ayrı satırlarda
 * göründüğü, Signal Loss/Failsafe Active/Digital CH17/CH18'in DÖRT AYRI alan
 * olarak (tek bir "RC LINK DEGRADED"e indirgenmeden) basıldığı ve geçersiz
 * start byte'ta kalan alanların yine de gösterildiği — `dronecan-decode.
 * spec.ts` emsali.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/aerospace-uav/rc-control-links/sbus?tab=decode';

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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('SBUS');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'sbus');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('typical-frame örneği 16 kanalın tümünü lsb-first sırayla doğru çözer', async ({ page }) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('typical-frame');

  // Beklenen: kanal i = i×100 (0, 100, …, 1500) — packedChannels.test.ts'teki
  // fixture'la AYNI. Yanlış bit sırası (msb-first) bu değerleri ÜRETMEZ.
  await expect(fieldRow(page, 'sbus-channel-0').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
  await expect(fieldRow(page, 'sbus-channel-1').getByTestId('decode-field-raw')).toHaveText('0x64 (100)');
  await expect(fieldRow(page, 'sbus-channel-8').getByTestId('decode-field-raw')).toHaveText('0x320 (800)');
  await expect(fieldRow(page, 'sbus-channel-15').getByTestId('decode-field-raw')).toHaveText('0x5DC (1500)');

  await expect(fieldRow(page, 'digital-channel-17').getByTestId('decode-field-physical')).toHaveText(
    'Not set',
  );
  await expect(fieldRow(page, 'digital-channel-18').getByTestId('decode-field-physical')).toHaveText(
    'Not set',
  );
  await expect(fieldRow(page, 'frame-lost').getByTestId('decode-field-physical')).toHaveText('Not set');
  await expect(fieldRow(page, 'failsafe-active').getByTestId('decode-field-physical')).toHaveText(
    'Not set',
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('failsafe-and-signal-loss örneği: Signal Loss VE Failsafe Active AYRI alanlar olarak Set görünür', async ({
  page,
}) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('failsafe-and-signal-loss');

  await expect(fieldRow(page, 'frame-lost').getByTestId('decode-field-physical')).toHaveText('Set');
  await expect(fieldRow(page, 'failsafe-active').getByTestId('decode-field-physical')).toHaveText('Set');
  // Dijital kanallar bu örnekte set DEĞİL — tek bir "RC LINK DEGRADED"e
  // indirgenmediğinin kanıtı: dört alan birbirinden BAĞIMSIZ.
  await expect(fieldRow(page, 'digital-channel-17').getByTestId('decode-field-physical')).toHaveText(
    'Not set',
  );
  await expect(fieldRow(page, 'digital-channel-18').getByTestId('decode-field-physical')).toHaveText(
    'Not set',
  );
});

test('digital-channels-17-18 örneği: yalnız dijital kanal bitleri Set, failsafe/signal-loss Not set', async ({
  page,
}) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('digital-channels-17-18');

  await expect(fieldRow(page, 'digital-channel-17').getByTestId('decode-field-physical')).toHaveText(
    'Set',
  );
  await expect(fieldRow(page, 'digital-channel-18').getByTestId('decode-field-physical')).toHaveText(
    'Set',
  );
  await expect(fieldRow(page, 'frame-lost').getByTestId('decode-field-physical')).toHaveText('Not set');
  await expect(fieldRow(page, 'failsafe-active').getByTestId('decode-field-physical')).toHaveText(
    'Not set',
  );
});

test('invalid-start-byte örneği decode-frame-error basar, ama kanallar yine gösterilir', async ({ page }) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('invalid-start-byte');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'start-delimiter-not-found');
  // Hatalı start byte'a rağmen kanal alanları yine basılır (spec §47).
  await expect(fieldRow(page, 'sbus-channel-0').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
  await expectNoRawTranslationKeys(page);
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
