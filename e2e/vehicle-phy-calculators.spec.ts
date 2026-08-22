import { expect, test } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 11h'nin gerçek tarayıcı turu — CAN / LIN / FlexRay PHY.
 *
 * Dalga 11g gibi decode'suz bir dalga: kanıtladığı şeyler üç sayfanın Kısmi
 * rozetiyle açıldığı, Zamanlama sekmesinde kendi hesaplayıcısına ve Genel
 * bakışta üstündeki çerçeve protokolüne bağlandığı (brief'in eksik dediği
 * çapraz-linkler) ve hesaplayıcıların doğru sayıları ürettiği.
 *
 * `related` bağlantıları YALNIZ Genel bakış, `calculatorIds` bağlantıları
 * YALNIZ Zamanlama sekmesinde basılır (dalga 11g'de öğrenildi).
 */

const tr = translations.tr;

const CAN_PHY = '/comm/interfaces-framing/vehicle-field-physical-layers/can-phy';
const LIN_PHY = '/comm/interfaces-framing/vehicle-field-physical-layers/lin-phy';
const FLEXRAY_PHY = '/comm/interfaces-framing/vehicle-field-physical-layers/flexray-phy';

test.describe('Araç PHY katalog sayfaları', () => {
  test('CAN PHY Kısmi rozetiyle açılır, hesaplayıcıya ve CAN çerçevesine bağlanır', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto(`${CAN_PHY}?tab=timing`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CAN PHY');
    await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: tr['calc.canPhy.name'] })).toBeVisible();
    await expect(page.getByRole('tab', { name: tr['tab.decode'] })).toHaveCount(0);

    await page.goto(`${CAN_PHY}?tab=overview`);
    await expect(page.getByRole('link', { name: 'CAN 2.0A', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'CAN FD', exact: true })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('LIN PHY ve FlexRay PHY kendi hesaplayıcılarına ve çerçevelerine bağlanır', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto(`${LIN_PHY}?tab=timing`);
    await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: tr['calc.linPhy.name'] })).toBeVisible();
    await page.goto(`${LIN_PHY}?tab=overview`);
    await expect(page.getByRole('link', { name: 'LIN', exact: true })).toBeVisible();

    await page.goto(`${FLEXRAY_PHY}?tab=timing`);
    await expect(page.getByRole('link', { name: tr['calc.flexrayPhy.name'] })).toBeVisible();
    await page.goto(`${FLEXRAY_PHY}?tab=overview`);
    await expect(page.getByRole('link', { name: 'FlexRay', exact: true })).toBeVisible();
  });
});

test.describe('CAN PHY hesaplayıcısı', () => {
  test('500 kbit/s %80 sample point bütçesi tutar, 2 Mbit/s tutmaz', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto('/comm/calculators/can-phy-timing');
    await expect(page.getByText(tr['calc.canPhy.withinBudget'], { exact: true })).toBeVisible();

    await page.locator('#calc-can-bitrate').fill('2000000');
    await expect(page.getByText(tr['calc.canPhy.overBudget'], { exact: true })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('sonlandırma bölümü spec’in 120‖120 = 60 ohm örneğini verir', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto('/comm/calculators/can-phy-timing');
    await page.getByRole('button', { name: tr['calc.field.canTermination'] }).click();

    await expect(page.getByText('60.0 Ω', { exact: true })).toBeVisible();

    // Kaynağın "3 adet termination" entegrasyon hatasının ölçülebilir izi.
    await page.locator('#calc-can-term-count').fill('3');
    await expect(page.getByText('40.0 Ω', { exact: true })).toBeVisible();
  });
});

test.describe('LIN ve FlexRay hesaplayıcıları', () => {
  test('LIN break 13 bitte ayırt edilebilir, 10 bitte değil', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto('/comm/calculators/lin-phy-timing');

    await expect(page.getByText(tr['calc.linPhy.breakLonger'], { exact: true })).toBeVisible();
    // Ölçülen sync açıklığından baud geri gelir (19200 çevresinde).
    await expect(page.getByText('19200 Bd', { exact: true })).toBeVisible();

    await page.locator('#calc-lin-breakbits').fill('10');
    await expect(page.getByText(tr['calc.linPhy.breakTooShort'], { exact: true })).toBeVisible();
  });

  test('FlexRay skew’i bit süresi cinsinden gösterir', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto('/comm/calculators/flexray-phy-timing');

    // 250 ns ile 400 ns arası 150 ns; 10 Mbit/s'te bit süresi 100 ns → 1.50 bit.
    await expect(page.getByText('1.50', { exact: true })).toBeVisible();

    await page.locator('#calc-flexray-delay-b').fill('250');
    await expect(page.getByText('0.00', { exact: true })).toBeVisible();
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/comm/calculators/can-phy-timing');
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
