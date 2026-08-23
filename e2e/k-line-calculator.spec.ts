import { expect, test } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 14a'nın gerçek tarayıcı turu — K-Line ve Automotive Ethernet.
 *
 * İkisinin de decode'u YOKTUR (LoRa paterni: `partial` + `pluginId` yok), bu
 * yüzden diğer protokol dalgalarından farklı: kanıtladığı şeyler sayfaların
 * Kısmi rozetiyle açıldığı, Canlı/Çözümle sekmelerinin HİÇ görünmediği,
 * Zamanlama sekmesinde hesaplayıcı bağlantısının GÖRÜNDÜĞÜ ve hesaplayıcının
 * `kLine.ts`/`singlePairEthernet.ts` motorlarını gerçekten ürettiği.
 */

const tr = translations.tr;

const K_LINE_TIMING = '/comm/automotive/legacy-diagnostics/k-line?tab=timing';
const K_LINE_OVERVIEW = '/comm/automotive/legacy-diagnostics/k-line?tab=overview';
const AUTO_ETH_TIMING = '/comm/automotive/automotive-ethernet/automotive-ethernet?tab=timing';
const AUTO_ETH_OVERVIEW = '/comm/automotive/automotive-ethernet/automotive-ethernet?tab=overview';
const K_LINE_CALC = '/comm/calculators/k-line-timing';

test.describe('K-Line katalog sayfası', () => {
  test('Kısmi rozetiyle açılır, Canlı/Çözümle sekmesi yok, hesaplayıcıya bağlanır', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto(K_LINE_TIMING);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('K-Line');
    await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();

    // İkisi de "hat olayı, decoder'a hiç girmez" kararının doğrudan sonucu.
    await expect(page.getByRole('tab', { name: tr['tab.live'] })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: tr['tab.decode'] })).toHaveCount(0);

    const calculatorLink = page.getByRole('link', { name: tr['calc.kLine.name'] });
    await expect(calculatorLink).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Genel bakışta ISO 9141, ISO 14230 ve UDS bağlantıları görünür', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(K_LINE_OVERVIEW);

    await expect(page.getByRole('link', { name: 'ISO 9141', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ISO 14230 (KWP2000)', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'UDS', exact: true })).toBeVisible();
  });

  test('hesaplayıcı bağlantısı gerçekten araca götürür', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(K_LINE_TIMING);
    await page.getByRole('link', { name: tr['calc.kLine.name'] }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(tr['calc.kLine.name']);
  });
});

test.describe('Automotive Ethernet katalog sayfası', () => {
  test('Kısmi rozetiyle açılır, Canlı/Çözümle sekmesi yok, hesaplayıcıya bağlanır', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto(AUTO_ETH_TIMING);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Automotive Ethernet');
    await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: tr['tab.live'] })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: tr['tab.decode'] })).toHaveCount(0);

    const calculatorLink = page.getByRole('link', { name: tr['calc.spePlca.name'] });
    await expect(calculatorLink).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Genel bakışta zaten ready olan yığın (Ethernet II, VLAN, IPv4, UDP, TCP, SPE) görünür', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(AUTO_ETH_OVERVIEW);

    await expect(page.getByRole('link', { name: 'Ethernet II', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'VLAN 802.1Q', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'IPv4', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'UDP', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'TCP', exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Single Pair Ethernet', exact: true }),
    ).toBeVisible();
    // Mevcut üç çapraz bağlantı da korunmalı.
    await expect(page.getByRole('link', { name: 'SOME/IP', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'DoIP', exact: true })).toBeVisible();
  });
});

test.describe('K-Line hesaplayıcısı', () => {
  test('5-baud init: varsayılan 8N1 karakteri 10 bit, adres baytı 2 saniye sürer', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto(K_LINE_CALC);
    await expect(page.getByText('10', { exact: true })).toBeVisible();
    await expect(page.getByText('200.000 ms', { exact: true })).toBeVisible();
    await expect(page.getByText('2.000000 s', { exact: true })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('fast init: 25 ms + 25 ms toplamı 50 ms, bütçe penceresi ile PASS/FAIL değişir', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(K_LINE_CALC);
    await page.getByRole('button', { name: tr['calc.field.kLineFastInitSection'] }).click();

    await expect(page.getByText('50.000 ms', { exact: true })).toBeVisible();

    // Pencere boşsa hiç sonuç basılmaz (opsiyonel alan) — LIN break asgarisi kararının aynısı.
    await expect(page.getByText(tr['calc.kLine.withinWindow'], { exact: true })).toHaveCount(0);

    await page.locator('#calc-kline-mintotal').fill('40');
    await page.locator('#calc-kline-maxtotal').fill('60');
    await expect(page.getByText(tr['calc.kLine.withinWindow'], { exact: true })).toBeVisible();

    await page.locator('#calc-kline-maxtotal').fill('45');
    await expect(page.getByText(tr['calc.kLine.aboveMaximum'], { exact: true })).toBeVisible();
  });

  test('bayt süresi & aralık bütçesi: varsayılanlar pencere içinde, aralığı daraltınca dışına çıkar', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(K_LINE_CALC);
    await page.getByRole('button', { name: tr['calc.field.kLineGapSection'] }).click();

    // 10 bit / 10400 baud ≈ 961.54 µs.
    await expect(page.getByText('961.54 µs', { exact: true })).toBeVisible();
    await expect(page.getByText(tr['calc.kLine.withinWindow'], { exact: true })).toBeVisible();

    await page.locator('#calc-kline-maxgap').fill('3');
    await expect(page.getByText(tr['calc.kLine.aboveMaximum'], { exact: true })).toBeVisible();
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(K_LINE_CALC);
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
