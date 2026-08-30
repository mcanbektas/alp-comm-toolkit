import { expect, test } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 11g'nin gerçek tarayıcı turu — Current Loop / 4–20 mA.
 *
 * Bu iki kaydın decode'u YOKTUR (LoRa paterni: `partial` + `pluginId` yok), bu
 * yüzden tur diğer dalgalardan farklı: kanıtladığı şeyler sayfaların Kısmi
 * rozetiyle açıldığı, Zamanlama sekmesinde hesaplayıcı bağlantısının GÖRÜNDÜĞÜ
 * (bağlantı basılmazsa motor kullanıcıya hiç ulaşmaz) ve hesaplayıcının spec'in
 * kendi iki fixture'ını gerçekten ürettiği.
 */

const tr = translations.tr;

const CURRENT_LOOP_TIMING = '/comm/interfaces-framing/serial-interfaces/current-loop?tab=timing';
const MA_4_20_TIMING = '/comm/interfaces-framing/serial-interfaces/4-20-ma?tab=timing';
const MA_4_20_OVERVIEW = '/comm/interfaces-framing/serial-interfaces/4-20-ma?tab=overview';
const LOOP_CALC = '/comm/calculators/current-loop';

test.describe('Current Loop / 4–20 mA katalog sayfaları', () => {
  test('Current Loop sayfası Kısmi rozetiyle açılır ve hesaplayıcıya bağlanır', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto(CURRENT_LOOP_TIMING);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Current Loop');
    await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();

    const calculatorLink = page.getByRole('link', { name: tr['calc.currentLoop.name'] });
    await expect(calculatorLink).toBeVisible();

    // Decode sekmesi hiç yok: çözülecek bayt akışı olmayan bir arayüz.
    await expect(page.getByRole('tab', { name: tr['tab.decode'] })).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('4–20 mA sayfası hesaplayıcıya (Zamanlama) ve HART’a (Genel bakış) bağlanır', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto(MA_4_20_TIMING);
    await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: tr['calc.currentLoop.name'] })).toBeVisible();

    // `related` bağlantıları YALNIZ Genel bakış sekmesinde basılır (ProtocolPage).
    await page.goto(MA_4_20_OVERVIEW);
    await expect(page.getByRole('link', { name: 'HART', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Current Loop', exact: true })).toBeVisible();
  });

  test('hesaplayıcı bağlantısı gerçekten araca götürür', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(CURRENT_LOOP_TIMING);
    await page.getByRole('link', { name: tr['calc.currentLoop.name'] }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(tr['calc.currentLoop.name']);
  });
});

test.describe('Akım döngüsü hesaplayıcısı', () => {
  test('spec ölçekleme fixture’ı: 0–250 bar aralığında 13.6 mA → 150.00', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto(LOOP_CALC);
    await expect(page.getByText('150.00', { exact: true })).toBeVisible();
    await expect(page.getByText('60.00 %', { exact: true })).toBeVisible();
    // 250 ohm shunt: 13.6 mA → 3.400 V
    await expect(page.getByText('3.400 V', { exact: true })).toBeVisible();
    await expect(page.getByText(tr['calc.loopState.normal'], { exact: true })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('aralık altı akım durumu değiştirir, eşik verilince kopuk döngü olur', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(LOOP_CALC);

    await page.locator('#calc-loop-current').fill('0.2');
    await expect(page.getByText(tr['calc.loopState.underRange'], { exact: true })).toBeVisible();

    // Kaynak eşik SAYISI vermiyor: eşik girilmeden kopuk döngü hiç raporlanmaz.
    await page.locator('#calc-loop-openloop').fill('3.6');
    await expect(page.getByText(tr['calc.loopState.openLoop'], { exact: true })).toBeVisible();
  });

  test('spec compliance fixture’ı: 24 V beslemede 17 V gerekir, 7 V kalır', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(LOOP_CALC);
    await page.getByRole('button', { name: tr['calc.field.loopCompliance'] }).click();

    await expect(page.getByText('17.00 V', { exact: true })).toBeVisible();
    await expect(page.getByText('7.00 V', { exact: true })).toBeVisible();
    await expect(
      page.getByText(tr['calc.loopCompliance.sufficient'], { exact: true }),
    ).toBeVisible();

    // Uzun kablo compliance'ı bitirir.
    await page.locator('#calc-loop-cable').fill('600');
    await expect(
      page.getByText(tr['calc.loopCompliance.insufficient'], { exact: true }),
    ).toBeVisible();
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(LOOP_CALC);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
