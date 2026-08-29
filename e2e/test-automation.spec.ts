/**
 * Test Automation Studio'nun gerçek tarayıcı turu (spec §38).
 *
 * Web Serial Playwright'ta YOK (`src/connection/types.ts` başlık yorumu); bu
 * ekranın tarayıcıda uçtan uca sınanabilmesi tamamen simüle cihaza bağlı.
 * Buradaki koşu gerçek `setTimeout`, gerçek `streamBuffer` ve gerçek çerçeve
 * kuyruğu üstünden gider — jsdom testinin kapsamadığı tek şey de bu.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translations } from '../src/translations';

const tr = translations.tr;

async function openStudio(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
    // Önceki koşudan kalan senaryo varsayılanı ezmesin.
    window.localStorage.removeItem('alp-comm-test-scenario');
  });

  // `/comm/` öneki ZORUNLU — bkz. smoke.spec.ts.
  await page.goto('/comm/test-automation');
  await expect(page.getByRole('heading', { level: 1, name: tr['testAutomation.title'] })).toBeVisible();
  return consoleErrors;
}

test('varsayılan senaryoyu simüle cihazda koşar ve GEÇER', async ({ page }) => {
  const consoleErrors = await openStudio(page);

  // Ekran boş açılmaz: §38 örneğinin adımları hazır.
  await expect(page.getByTestId('ta-name')).toHaveValue('Sıcaklık durum testi');
  await expect(page.getByTestId('ta-step-crc')).toBeVisible();

  await page.getByTestId('ta-run').click();

  await expect(page.getByTestId('ta-run-status')).toHaveText(tr['testAutomation.runStatus.passed'], { timeout: 15_000 });
  await expect(page.getByTestId('ta-fail-count')).toHaveText('0');
  await expect(page.getByTestId('ta-pass-count')).toHaveText('10');

  // Rapor tablosu adım satırlarını basıyor.
  await expect(page.getByRole('grid', { name: tr['testAutomation.table.label'] })).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('eşik düşünce doğrulama adımı KALIR', async ({ page }) => {
  const consoleErrors = await openStudio(page);

  // Fixture'ın sıcaklık baytı 0x34 = 52; eşiği 10 yapmak testi düşürmeli.
  await page.getByTestId('step-limit-right-value').fill('10');
  await page.getByTestId('ta-run').click();

  await expect(page.getByTestId('ta-run-status')).toHaveText(tr['testAutomation.runStatus.failed'], { timeout: 15_000 });
  await expect(page.getByTestId('ta-fail-count')).toHaveText('1');

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('uzun beklemedeki koşu İPTAL edilebilir', async ({ page }) => {
  const consoleErrors = await openStudio(page);

  // 30 saniyelik bekleme: iptal olmasaydı koşu adımın sonunu beklerdi.
  await page.getByTestId('step-settle-duration').fill('30000');
  await page.getByTestId('ta-run').click();
  await expect(page.getByTestId('ta-running')).toBeVisible();

  await page.getByTestId('ta-cancel').click();
  await expect(page.getByTestId('ta-run-status')).toHaveText(tr['testAutomation.runStatus.cancelled'], { timeout: 10_000 });

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('senaryoya adım eklenip silinebilir', async ({ page }) => {
  const consoleErrors = await openStudio(page);

  await page.getByTestId('ta-add-step').selectOption('loop');
  await expect(page.getByTestId('ta-step-loop-1')).toBeVisible();
  // Döngü boş doğmaz; içinde bir adımla gelir.
  await expect(page.getByTestId('ta-step-loop-1-log')).toBeVisible();

  await page.getByTestId('ta-remove-loop-1').click();
  await expect(page.getByTestId('ta-step-loop-1')).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStudio(page);
  await page.getByTestId('ta-run').click();
  await expect(page.getByTestId('ta-run-status')).toBeVisible({ timeout: 15_000 });

  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});

/**
 * `send-frame`in üçüncü kaynağı: yükü protokolün KENDİ encoder'ının zarfına
 * sarar (spec §7). Motor lazy yüklendiği için gerçek tarayıcıda seçim ile
 * yazılan bayt arasında bir ağ isteği vardır — jsdom'da görünmeyen tek şey bu.
 */
test('gönderim adımı yükü protokolün kendi zarfıyla çerçeveler', async ({ page }) => {
  const consoleErrors = await openStudio(page);

  await page.getByTestId('ta-add-step').selectOption('send-frame');
  await expect(page.getByTestId('ta-step-send-frame-1')).toBeVisible();
  // Yeni adım sonda; bağlantı kapanmasın diye `disconnect` kaldırılıyor.
  await page.getByTestId('ta-remove-disconnect').click();

  await page.getByTestId('step-send-frame-1-source').selectOption('plugin-frame');
  await page.getByTestId('step-send-frame-1-plugin').selectOption('hdlc');
  await page.getByTestId('step-send-frame-1-bytes').fill('01 02');

  await page.getByTestId('ta-run').click();
  await expect(page.getByTestId('ta-run-status')).toHaveText(tr['testAutomation.runStatus.passed'], {
    timeout: 15_000,
  });

  // Kabloya çıkan şey yük DEĞİL, HDLC zarfıdır: 7E … FCS FCS 7E.
  const row = page.getByRole('row').filter({ hasText: 'send-frame-1' });
  await expect(row).toContainText(/7E 01 02 .. .. 7E/);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});
