import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 14g'nin gerçek tarayıcı turu — SPC (Short PWM Code).
 *
 * Kanıtladığı şeyler: kayıt Hazır rozetiyle açılıyor; tetik darbesi VE SENT
 * yanıt çerçevesi AYNI alan tablosunda birlikte görünüyor (`sent.ts`in
 * çözücüsü GERÇEKTEN çağrılıyor — `spc.test.ts`teki birim kanıtın tarayıcı
 * turu); "No response" ve rezerve-tetik hata sınıfları çerçeveyi geçersiz
 * işaretliyor; CRC satırı `sent`inkiyle AYNI "doğrulanmadı" uyarısını taşıyor.
 */

const tr = translations.tr;

const SPC_DECODE_PATH = '/comm/automotive/sensor-interfaces/spc?tab=decode';

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
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

test.describe('SPC', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, SPC_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SPC');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'spc');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('tetik darbesi VE SENT yanıt çerçevesi AYNI alan tablosunda birlikte görünür', async ({ page }) => {
    await openDecodePanel(page, SPC_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-response');

    // Tetik — SPC'ye özgü.
    await expect(fieldRow(page, 'trigger')).toBeVisible();
    // Yanıt — sent.ts'in ÇÖZÜCÜSÜNÜN ürettiği AYNI alan id'leri.
    await expect(fieldRow(page, 'sync')).toBeVisible();
    await expect(fieldRow(page, 'estimatedTickTime')).toBeVisible();
    await expect(fieldRow(page, 'status')).toBeVisible();
    await expect(fieldRow(page, 'data-nibble-1')).toBeVisible();
    await expect(fieldRow(page, 'data-nibble-6')).toBeVisible();
    await expect(fieldRow(page, 'crc')).toBeVisible();
  });

  test('CRC satırı sent’inkiyle AYNI "doğrulanmadı" uyarısını taşır', async ({ page }) => {
    await openDecodePanel(page, SPC_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-response');

    const crcPhysical = fieldRow(page, 'crc').getByTestId('decode-field-physical');
    await expect(crcPhysical).not.toContainText('Valid');
    await expect(crcPhysical).not.toContainText('Invalid');

    await expect(fieldWarning(page, 'crc')).toHaveCount(1);
    await expect(fieldWarning(page, 'crc')).toContainText(tr['protocol.sent.warning.crcNotVerified']);
  });

  test('tetik süresi ayrı bir alanda gösterilir', async ({ page }) => {
    await openDecodePanel(page, SPC_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-response');

    await expect(fieldRow(page, 'trigger').getByTestId('decode-field-physical')).toContainText('µs');
  });

  test('"No response" örneği çerçeveyi geçersiz işaretler ama tetik alanını GÖSTERMEYE devam eder', async ({
    page,
  }) => {
    await openDecodePanel(page, SPC_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('no-response');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).not.toHaveCount(0);
    await expect(fieldRow(page, 'trigger')).toBeVisible();
    await expect(fieldRow(page, 'sync')).toHaveCount(0);
  });

  test('rezerve tetik darbesi ("Trigger too short" vekili) çerçeveyi geçersiz işaretler', async ({ page }) => {
    await openDecodePanel(page, SPC_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('trigger-reserved');

    await expect(fieldWarning(page, 'trigger')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).not.toHaveCount(0);
  });

  test('yarıda kesilmiş yanıt decode-parse-error basar', async ({ page }) => {
    await openDecodePanel(page, SPC_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('truncated-response');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute('data-error-code', 'truncated-frame');
  });

  test('sensorProfile şıkkı sent’in profil şıklarıyla AYNI seçenekleri sunar', async ({ page }) => {
    await openDecodePanel(page, SPC_DECODE_PATH);
    const select = page.getByLabel(tr['protocol.spc.option.sensorProfile']);
    await expect(select).toBeVisible();
    const options = await select.locator('option').allTextContents();
    expect(options.some((text) => text.includes('SAE J2716 Standard'))).toBe(true);
  });
});

test.describe('SPC sayfası — düzen', () => {
  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, SPC_DECODE_PATH);
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
