import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 14f'in gerçek tarayıcı turu — SAE J1850 PWM + VPW.
 *
 * Kanıtladığı şeyler: iki kayıt da Hazır rozetiyle açılıyor; PWM'de
 * `bitThreshold` (profil `custom`e alınınca) ÇÖZÜLEN BİTİ değiştiriyor; VPW'de
 * `initialLevel` değişimi alan tablosunu (aynı nabızlar farklı bit) değiştiriyor;
 * VPW'de `payloadInterpretation: obd-ii` seçilince Data alanı kaybolup OBD
 * alanları beliriyor (`devicenet-decode.spec.ts`in `cip-explicit` deseni
 * birebir emsal); CRC PASS/FAIL AYRI satır ve bağımsız gösteriliyor.
 */

const tr = translations.tr;

const PWM_DECODE_PATH = '/comm/automotive/vehicle-network-protocols/sae-j1850-pwm?tab=decode';
const VPW_DECODE_PATH = '/comm/automotive/vehicle-network-protocols/sae-j1850-vpw?tab=decode';

async function openDecodePanel(page: Page, path: string): Promise<string[]> {
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
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

function fieldWarning(page: Page, fieldId: string): Locator {
  // Tuzak (12d/12e/14e): alan uyarısı AYRI bir <tr>de basılır — fieldRow().getByTestId()
  // boş döner, kökten aramak şart.
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

function frameWarning(page: Page, text: string): Locator {
  // Birden çok çerçeve uyarısı aynı anda basılabilir (ör. header-unresolved +
  // data-may-be-obd); getByTestId tek başına strict-mode ihlali verir.
  return page.locator('[data-testid="decode-frame-warning"]').filter({ hasText: text });
}

test.describe('SAE J1850 PWM', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, PWM_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SAE J1850 PWM');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'sae-j1850-pwm');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('profil İLK SATIRDIR ve yürürlükteki profili adıyla basar', async ({ page }) => {
    await openDecodePanel(page, PWM_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-frame');

    const firstRow = page.locator('[data-testid="decode-field-row"]').first();
    await expect(firstRow).toHaveAttribute('data-field-id', 'profile');
    await expect(firstRow.getByTestId('decode-field-raw')).toContainText('SAE Standard');
  });

  test('profile=custom + bitThreshold değişince ÇÖZÜLEN BİT değişir', async ({ page }) => {
    await openDecodePanel(page, PWM_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-frame');

    const headerRaw = fieldRow(page, 'header').getByTestId('decode-field-raw');
    await expect(headerRaw).toHaveText('0x61 (97)');

    await page.getByLabel(tr['protocol.j1850.pwm.option.profile']).selectOption('custom');
    await page.getByLabel(tr['protocol.j1850.pwm.option.bitThreshold']).fill('20');

    // Eşik 16 µs'nin (spec'in en uzun örnek darbesi) ÜSTÜNE çıkınca örnekteki
    // TÜM darbeler kısa sayılır ve header'ın sekiz biti de 1'e döner.
    await expect(headerRaw).toHaveText('0xFF (255)');
  });

  test('CRC PASS/FAIL AYRI satır ve bağımsız gösterilir', async ({ page }) => {
    await openDecodePanel(page, PWM_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('valid-frame');
    await expect(fieldRow(page, 'crc').getByTestId('decode-field-physical')).toHaveText('Valid');
    await expect(fieldWarning(page, 'crc')).toHaveCount(0);

    await page.getByLabel(tr['decode.example.label']).selectOption('bad-crc');
    await expect(fieldRow(page, 'crc').getByTestId('decode-field-physical')).toContainText('Invalid');
    await expect(fieldWarning(page, 'crc')).toHaveCount(1);
    // success:true — kısmi çözüm gösterilir (header hâlâ okunur), decode-parse-error DEĞİL.
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).not.toHaveCount(0);
  });

  test('Header HAM kalır ve uyarı taşır', async ({ page }) => {
    await openDecodePanel(page, PWM_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-frame');

    // physicalValue BİLEREK yok: isme bağlanmıyor (J2178/J1979 kapsam dışı).
    await expect(fieldRow(page, 'header').getByTestId('decode-field-physical')).toHaveText('—');
    await expect(fieldWarning(page, 'header')).toHaveCount(1);
  });

  test('eksik çerçeve (bayta tamamlanmayan nabız sayısı) decode-parse-error basar', async ({ page }) => {
    await openDecodePanel(page, PWM_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('truncated');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
    );
  });
});

test.describe('SAE J1850 VPW', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, VPW_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SAE J1850 VPW');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'sae-j1850-vpw');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('initialLevel değişimi alan tablosunu değiştirir (AYNI nabızlar, FARKLI bit)', async ({ page }) => {
    await openDecodePanel(page, VPW_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-frame');

    const headerRaw = fieldRow(page, 'header').getByTestId('decode-field-raw');
    const before = await headerRaw.textContent();

    await page.getByLabel(tr['protocol.j1850.vpw.option.initialLevel']).selectOption('passive');

    await expect(headerRaw).not.toHaveText(before ?? '');
  });

  test('payloadInterpretation=raw (varsayılan): Data alanı ham kalır, obd-ii uyarısı basılır', async ({
    page,
  }) => {
    await openDecodePanel(page, VPW_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-frame');

    await expect(fieldRow(page, 'data')).toHaveCount(1);
    await expect(page.locator('[data-field-id^="obd-"]')).toHaveCount(0);
    await expect(frameWarning(page, tr['protocol.j1850.vpw.warning.dataMayBeObd'])).toBeVisible();
  });

  test('payloadInterpretation=obd-ii: Data alanı KAYBOLUR, parseObd’ın alanları BELİRİR', async ({
    page,
  }) => {
    await openDecodePanel(page, VPW_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-frame');

    await page
      .getByLabel(tr['protocol.j1850.vpw.option.payloadInterpretation'])
      .selectOption('obd-ii');

    await expect(fieldRow(page, 'data')).toHaveCount(0);
    await expect(fieldRow(page, 'obd-mode').getByTestId('decode-field-physical')).toHaveText(
      'Current Data',
    );
    await expect(fieldRow(page, 'obd-parameters').getByTestId('decode-field-raw')).not.toHaveCount(0);
  });

  test('CRC PASS/FAIL AYRI satır ve bağımsız gösterilir', async ({ page }) => {
    await openDecodePanel(page, VPW_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('valid-frame');
    await expect(fieldRow(page, 'crc').getByTestId('decode-field-physical')).toHaveText('Valid');

    await page.getByLabel(tr['decode.example.label']).selectOption('bad-crc');
    await expect(fieldRow(page, 'crc').getByTestId('decode-field-physical')).toContainText('Invalid');
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).not.toHaveCount(0);
  });

  test('sae-j1850-pwm sayfasında payloadInterpretation kanalı YOK', async ({ page }) => {
    await openDecodePanel(page, PWM_DECODE_PATH);
    await expect(page.locator('[id^="decode-option-"]')).toHaveCount(2);
    await expect(page.locator('#decode-option-payloadInterpretation')).toHaveCount(0);
  });
});

test.describe('SAE J1850 sayfaları — düzen', () => {
  test('1440 ve 390 pikselde yatay taşma yok (PWM)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, PWM_DECODE_PATH);
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });

  test('1440 ve 390 pikselde yatay taşma yok (VPW)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, VPW_DECODE_PATH);
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
