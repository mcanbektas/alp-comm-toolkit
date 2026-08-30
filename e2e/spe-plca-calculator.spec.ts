import { expect, test } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 11k'nin ikinci tarayıcı turu — Single Pair Ethernet.
 *
 * Bu kaydın decode'u YOK (LoRa paterni), bu yüzden tur Current Loop turunun
 * aynısını kanıtlar: sayfa Kısmi rozetiyle açılıyor, Zamanlama sekmesinde
 * hesaplayıcı bağlantısı GERÇEKTEN basılıyor (11g'de öğrenilen kural) ve
 * hesaplayıcı beklenen sayıları üretiyor. Ayrıca BEACON boş bırakıldığında
 * bunun kullanıcıya söylendiği.
 */

const tr = translations.tr;

const SPE_TIMING = '/comm/interfaces-framing/host-network-interfaces/single-pair-ethernet?tab=timing';
const SPE_OVERVIEW = '/comm/interfaces-framing/host-network-interfaces/single-pair-ethernet?tab=overview';
const SPE_CALC = '/comm/calculators/spe-plca';

test.describe('Single Pair Ethernet katalog sayfası', () => {
  test('Kısmi rozetiyle açılır, Çözümle sekmesi yok, hesaplayıcıya bağlanır', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto(SPE_TIMING);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Single Pair Ethernet');
    await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: tr['tab.decode'] })).toHaveCount(0);
    await expect(page.getByRole('link', { name: tr['calc.spePlca.name'] })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Genel bakış sekmesinde Ethernet Interface çapraz-linki görünür', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(SPE_OVERVIEW);
    await expect(page.getByRole('link', { name: 'Ethernet Interface', exact: true })).toBeVisible();
  });

  test('hesaplayıcı bağlantısı gerçekten araca götürür', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(SPE_TIMING);
    await page.getByRole('link', { name: tr['calc.spePlca.name'] }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(tr['calc.spePlca.name']);
  });
});

test.describe('SPE / PLCA hesaplayıcısı', () => {
  test('10BASE-T1S: 64 baytlık çerçeve 51.20 µs sürer', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto(SPE_CALC);
    await expect(page.getByText('10 Mbit/s', { exact: true })).toBeVisible();
    await expect(page.getByText('100.00 ns', { exact: true })).toBeVisible();
    await expect(page.getByText('512 BT', { exact: true })).toBeVisible();
    await expect(page.getByText('51.20 µs', { exact: true })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('PHY sınıfı değişince bit süresi de değişir', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(SPE_CALC);

    await page.locator('#calc-spe-phy').selectOption('1000base-t1');
    await expect(page.getByText('1000 Mbit/s', { exact: true })).toBeVisible();
    await expect(page.getByText('1.00 ns', { exact: true })).toBeVisible();
  });

  test('PLCA çevrimi: 8 node, 2 gönderen, to_timer 32 → 121.60 µs', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(SPE_CALC);
    await page.getByRole('button', { name: tr['calc.field.plcaSection'] }).click();

    await expect(page.getByText('192 BT', { exact: true })).toBeVisible();
    await expect(page.getByText('1024 BT', { exact: true })).toBeVisible();
    await expect(page.getByText('1216 BT', { exact: true })).toBeVisible();
    // Çevrim süresi ve en kötü erişim gecikmesi AYNI değerdir (sıra bir tur
    // sonra döner) — iki satır da 121.60 µs basar.
    await expect(page.getByText('121.60 µs', { exact: true })).toHaveCount(2);
    // BEACON girilmedi: çevrime eklenmediği açıkça söylenir.
    await expect(page.getByText(tr['calc.field.plcaBeaconOmitted'])).toBeVisible();
  });

  test('BEACON girilince çevrime eklenir ve uyarı kalkar', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(SPE_CALC);
    await page.getByRole('button', { name: tr['calc.field.plcaSection'] }).click();

    await page.locator('#calc-plca-beacon').fill('20');
    await expect(page.getByText('1236 BT', { exact: true })).toBeVisible();
    await expect(page.getByText(tr['calc.field.plcaBeaconOmitted'])).toHaveCount(0);
  });

  test('burst kapalıyken pencere tek paket, MAXBC verilince büyür', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(SPE_CALC);
    await page.getByRole('button', { name: tr['calc.field.plcaSection'] }).click();

    await expect(page.getByText(tr['calc.field.plcaBurstDisabled'], { exact: true })).toBeVisible();

    await page.locator('#calc-plca-maxbc').fill('2');
    // 3 paket × 512 BT + 2 × 128 BT = 1792 BT = 179.20 µs
    await expect(page.getByText('3 × · 179.20 µs', { exact: true })).toBeVisible();
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(SPE_CALC);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: tr['calc.field.plcaSection'] }).click();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
