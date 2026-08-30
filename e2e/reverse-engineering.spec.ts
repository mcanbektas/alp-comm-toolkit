/**
 * Unknown Protocol Analyzer'ın GERÇEK tarayıcı turu (spec §35 + §36).
 *
 * Birim testleri jsdom'da koşuyor ve orada `Worker` YOK: analiz ana iş
 * parçacığının yedek yolundan geçiyor. Worker'ın kendisi — `new Worker(new
 * URL(…))` çözümlemesi, paketlenmiş çerçevelerin transfer listesiyle gidişi,
 * adım adım ilerleme — yalnız burada kanıtlanır.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translations } from '../src/translations/all';

const tr = translations.tr;

/** Spec 35060 RF telemetri seti; ekran zaten bununla açılıyor. */
const RF_DUMP = ['AA AA 10 00 01 53 21', 'AA AA 10 00 02 61 38', 'AA AA 10 00 03 14 B7', 'AA AA 10 00 04 8F 42'].join('\n');

const CANDUMP_LOG = [
  '(1637856000.100000) can0 123#AAAA100001',
  '(1637856000.200000) can0 123#AAAA100002',
  '(1637856000.300000) can0 123#AAAA100003',
].join('\n');

async function openAnalyzer(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  // `/comm/` öneki ZORUNLU — bkz. smoke.spec.ts.
  await page.goto('/comm/reverse-engineering');
  await expect(page.getByRole('heading', { level: 1, name: tr['reverseEngineering.title'] })).toBeVisible();
  return consoleErrors;
}

test('varsayılan örneği Worker üzerinden analiz eder ve alan rollerini basar', async ({ page }) => {
  const consoleErrors = await openAnalyzer(page);

  // Ekran boş AÇILMAZ: kutuda spec örneği hazır durur.
  await expect(page.getByTestId('re-input')).toHaveValue(RF_DUMP);

  await page.getByTestId('re-analyze').click();

  const columns = page.getByRole('grid', { name: tr['reverseEngineering.columns.label'] });
  await expect(columns).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('re-frame-count')).toHaveText('4');
  await expect(page.getByTestId('re-length-range')).toHaveText('7…7');

  // Sabit başlık (0-3) ve sayaç adayı (4) — spec 35060'ın beklenen çıktısı.
  await expect(columns.getByText(tr['reverseEngineering.role.constant']).first()).toBeVisible();
  await expect(columns.getByText(tr['reverseEngineering.role.counter']).first()).toBeVisible();

  await expect(page.getByTestId('re-counters')).toBeVisible();
  await expect(page.getByTestId('re-diff-summary')).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('akış modunda sabit uzunlukla çerçeveler', async ({ page }) => {
  const consoleErrors = await openAnalyzer(page);

  await page.getByTestId('re-mode').selectOption('stream');
  await page.getByTestId('re-framing').selectOption('fixed-length');
  await page.getByTestId('re-framing-parameter').fill('7');
  await page.getByTestId('re-analyze').click();

  await expect(page.getByTestId('re-frame-count')).toHaveText('4', { timeout: 15_000 });
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('log dosyasını okuyup aynı analizi koşar', async ({ page }) => {
  const consoleErrors = await openAnalyzer(page);

  await page.getByTestId('re-file').setInputFiles({
    name: 'kayit.log',
    mimeType: 'text/plain',
    buffer: Buffer.from(CANDUMP_LOG, 'utf-8'),
  });

  // Dosya yolu iki Worker'ı arka arkaya kullanır: önce log ayrıştırma, sonra analiz.
  await expect(page.getByTestId('re-file-name')).toContainText('kayit.log', { timeout: 15_000 });
  await expect(page.getByTestId('re-frame-count')).toHaveText('3');

  await page.getByTestId('re-analyze').click();
  await expect(page.getByRole('grid', { name: tr['reverseEngineering.columns.label'] })).toBeVisible({
    timeout: 15_000,
  });

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAnalyzer(page);
  await page.getByTestId('re-analyze').click();
  await expect(page.getByTestId('re-diff-summary')).toBeVisible({ timeout: 15_000 });

  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
