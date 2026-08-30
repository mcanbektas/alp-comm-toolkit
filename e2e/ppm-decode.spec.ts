import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 15e'nin gerçek tarayıcı turu — PPM.
 *
 * Kanıtladığı şeyler: sayfa Hazır rozetiyle açılıyor; `syncGapUs` VERİLMEDEN
 * nabızlar HAM sırayla listeleniyor ve `syncGapRequiredForChannelSplit`
 * uyarısı görünüyor; `syncGapUs` girilince kanallar (CH1, CH2, …) ve Sync Gap
 * ayrılıyor; normalize alan YALNIZ üç kalibrasyon değeri (Min/Center/Max) de
 * verildiğinde beliriyor; `canParse` otomatik algılamaya HİÇ girmediği için
 * sayfa yalnız KULLANICI açıkça seçtiğinde çalışıyor (bu sayfanın KENDİSİ
 * zaten o açık seçim).
 */

const tr = translations.tr;

const PPM_DECODE_PATH = '/comm/aerospace-uav/rc-control-links/ppm?tab=decode';

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

function frameWarning(page: Page, text: string): Locator {
  // Tuzak (12d/12e/14e-14h): birden çok çerçeve uyarısı aynı anda basılabilir —
  // getByTestId tek başına strict-mode ihlali verir, .filter({hasText}) şart.
  return page.locator('[data-testid="decode-frame-warning"]').filter({ hasText: text });
}

test.describe('PPM', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, PPM_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PPM');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ppm');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('syncGapUs VERİLMEDEN: nabızlar HAM sırayla listelenir ve uyarı görünür', async ({ page }) => {
    await openDecodePanel(page, PPM_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('two-channel-worked-example');

    // Varsayılan durumda syncGapUs alanı 0 (VERİLMEDİ sentinel'i) — kanal ayrımı YOK.
    // `decode-field-physical` hücresi `physicalValue`ya `unit`i BOŞLUKLA ekler
    // (DecodePanel.tsx `formatPhysicalCell` — tüm protokollerde ortak biçim).
    await expect(fieldRow(page, 'pulse-0')).toBeVisible();
    await expect(fieldRow(page, 'pulse-0').getByTestId('decode-field-physical')).toHaveText('1502.0 µs');
    await expect(fieldRow(page, 'ch-1')).toHaveCount(0);
    await expect(fieldRow(page, 'sync-gap')).toHaveCount(0);
    await expect(
      frameWarning(page, tr['protocol.ppm.warning.syncGapRequiredForChannelSplit']),
    ).toBeVisible();
  });

  test('syncGapUs girilince kanallar (CH1/CH2) ve Sync Gap ayrılır — spec çalışılmış örneği', async ({
    page,
  }) => {
    await openDecodePanel(page, PPM_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('two-channel-worked-example');
    await page.getByLabel(tr['protocol.ppm.option.syncGapUs']).fill('4000');

    // Spec `:254`: kenarlar 0/1502/3001 µs → CH1=1502, CH2=1499.
    await expect(fieldRow(page, 'ch-1').getByTestId('decode-field-physical')).toHaveText('1502.0 µs');
    await expect(fieldRow(page, 'ch-2').getByTestId('decode-field-physical')).toHaveText('1499.0 µs');
    await expect(fieldRow(page, 'sync-gap').getByTestId('decode-field-physical')).toHaveText('4000.0 µs');
    await expect(fieldRow(page, 'pulse-0')).toHaveCount(0);
    await expect(
      frameWarning(page, tr['protocol.ppm.warning.syncGapRequiredForChannelSplit']),
    ).toHaveCount(0);
  });

  test('normalize alan YALNIZ üç kalibrasyon değeri de verilince belirir — spec :263', async ({ page }) => {
    await openDecodePanel(page, PPM_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('two-channel-worked-example');
    await page.getByLabel(tr['protocol.ppm.option.syncGapUs']).fill('4000');

    // Yalnız min/center verildi (max eksik) — normalize alan HENÜZ YOK.
    await page.getByLabel(tr['protocol.ppm.option.minPulseUs']).fill('1000');
    await page.getByLabel(tr['protocol.ppm.option.centerPulseUs']).fill('1500');
    await expect(fieldRow(page, 'ch-1-normalized')).toHaveCount(0);

    // Üçüncü değer de girilince (max) — spec :263 örneği: Pulse=1750 → +0.5.
    // Burada CH1=1502 kullanılıyor, farklı bir kalibrasyon örneğiyle sınamak için
    // örnek örneği değiştirmek yerine mevcut CH1 değeriyle normalize formülü kanıtlanır.
    await page.getByLabel(tr['protocol.ppm.option.maxPulseUs']).fill('2000');
    await expect(fieldRow(page, 'ch-1-normalized')).toBeVisible();
    // CH1=1502, Center=1500, Max=2000 → (1502-1500)/(2000-1500) = 0.004.
    await expect(fieldRow(page, 'ch-1-normalized').getByTestId('decode-field-physical')).toHaveText(
      '0.004',
    );
  });

  test('typical-eight-channel-capture: doygun sync gap (6553.5 µs) senkron olarak TANINIR', async ({
    page,
  }) => {
    await openDecodePanel(page, PPM_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('typical-eight-channel-capture');
    // Gerçek kalibrasyon 8000 µs — konteynerin kendi üst sınırından (6553.5) BÜYÜK.
    await page.getByLabel(tr['protocol.ppm.option.syncGapUs']).fill('8000');

    await expect(fieldRow(page, 'ch-1').getByTestId('decode-field-physical')).toHaveText('1000.0 µs');
    await expect(fieldRow(page, 'ch-8').getByTestId('decode-field-physical')).toHaveText('1700.0 µs');
    await expect(fieldRow(page, 'sync-gap').getByTestId('decode-field-physical')).toHaveText(
      '≥ 6553.5 µs',
    );
    await expect(
      frameWarning(page, tr['protocol.ppm.warning.pulseMayBeSaturated']),
    ).toBeVisible();
    // decode-frame-error YOK — bu bir hata değil, ölçüm sınırının dürüst bildirimi.
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('reserved-mid-frame: rezerve kanal HAM/geçersiz gösterilir, diğer kanallar etkilenmez', async ({
    page,
  }) => {
    await openDecodePanel(page, PPM_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('reserved-mid-frame');
    await page.getByLabel(tr['protocol.ppm.option.syncGapUs']).fill('4000');

    await expect(fieldRow(page, 'ch-2')).toHaveAttribute('data-valid', 'false');
    await expect(fieldRow(page, 'ch-1').getByTestId('decode-field-physical')).toHaveText('1500.0 µs');
    await expect(fieldRow(page, 'ch-3').getByTestId('decode-field-physical')).toHaveText('1500.0 µs');
  });

  test('eksik çerçeve (tek uzunluk) decode-parse-error basar', async ({ page }) => {
    await openDecodePanel(page, PPM_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('truncated');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute('data-error-code', 'truncated-frame');
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, PPM_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('typical-eight-channel-capture');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
