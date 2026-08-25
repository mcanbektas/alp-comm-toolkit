import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 14g'nin gerçek tarayıcı turu — SENT (SAE J2716).
 *
 * Kanıtladığı şeyler: kayıt Hazır rozetiyle açılıyor; Estimated Tick Time
 * TÜRETİLMİŞ bir alan olarak (kendi rawValue'su OLMADAN, yalnız physicalValue)
 * görünüyor; profil şıkkı (custom + dataNibbleCount) çözülen NIBBLE SAYISINI
 * gerçekten değiştiriyor; CRC satırı Received değeri gösterir ama
 * DOĞRULANMADIĞINI açıkça uyarıyla bildirir — PWM/VPW'nin PASS/FAIL
 * biçiminden BİLEREK FARKLI (`j1850-decode.spec.ts` emsali, CRC bölümü).
 */

const tr = translations.tr;

const SENT_DECODE_PATH = '/comm/automotive/sensor-interfaces/sent?tab=decode';

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
  // Tuzak (12d/12e/14e/14f): alan uyarısı AYRI bir <tr>de basılır — köke bakılır.
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

test.describe('SENT', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, SENT_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SENT');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'sent');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('profil İLK SATIRDIR ve yürürlükteki profili adıyla basar', async ({ page }) => {
    await openDecodePanel(page, SENT_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-frame');

    const firstRow = page.locator('[data-testid="decode-field-row"]').first();
    await expect(firstRow).toHaveAttribute('data-field-id', 'profile');
    await expect(firstRow.getByTestId('decode-field-raw')).toContainText('SAE J2716 Standard');
  });

  test('Estimated Tick Time TÜRETİLMİŞ bir alandır — kendi raw kaydı yok, yalnız physicalValue', async ({
    page,
  }) => {
    await openDecodePanel(page, SENT_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-frame');

    const tickRow = fieldRow(page, 'estimatedTickTime');
    await expect(tickRow).toBeVisible();
    // Türetilmiş: kendine ait bir "tel üzerindeki sayı" (rawValue) YOK.
    await expect(tickRow.getByTestId('decode-field-raw')).toHaveText('—');
    // Ama fiziksel (türetilmiş) değer VAR ve birimi µs.
    await expect(tickRow.getByTestId('decode-field-physical')).toContainText('µs');
  });

  test('profile=custom + dataNibbleCount değişince ÇÖZÜLEN NIBBLE SAYISI gerçekten değişir', async ({
    page,
  }) => {
    await openDecodePanel(page, SENT_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-frame');

    // Varsayılan profilde (6 veri nibble'ı) örnek çerçeve 6 alan taşır.
    await expect(fieldRow(page, 'data-nibble-6')).toHaveCount(1);

    await page.getByLabel(tr['protocol.sent.option.profile']).selectOption('custom');
    await page.getByLabel(tr['protocol.sent.option.dataNibbleCount']).fill('3');

    await expect(fieldRow(page, 'data-nibble-3')).toHaveCount(1);
    await expect(fieldRow(page, 'data-nibble-4')).toHaveCount(0);
    await expect(fieldRow(page, 'data-nibble-6')).toHaveCount(0);
  });

  test('CRC satırı ALINAN değeri gösterir ama DOĞRULANMADIĞINI açıkça bildirir — PASS/FAIL basılmaz', async ({
    page,
  }) => {
    await openDecodePanel(page, SENT_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('valid-frame');

    const crcPhysical = fieldRow(page, 'crc').getByTestId('decode-field-physical');
    await expect(crcPhysical).not.toContainText('Valid');
    await expect(crcPhysical).not.toContainText('Invalid');
    await expect(crcPhysical).not.toContainText('PASS');
    await expect(crcPhysical).not.toContainText('FAIL');

    await expect(fieldWarning(page, 'crc')).toHaveCount(1);
    await expect(fieldWarning(page, 'crc')).toContainText(tr['protocol.sent.warning.crcNotVerified']);
  });

  test('geçersiz nibble (bant dışı tick sayısı) çerçeveyi geçersiz kılar ve alanı işaretler', async ({
    page,
  }) => {
    await openDecodePanel(page, SENT_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('invalid-nibble');

    await expect(page.getByTestId('decode-frame-error')).not.toHaveCount(0);
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
  });

  test('eksik çerçeve (varsayılan profil için yetersiz nabız) decode-parse-error basar', async ({ page }) => {
    await openDecodePanel(page, SENT_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('truncated');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute('data-error-code', 'truncated-frame');
  });

  test('Pause Pulse örneğinde ayrı bir alan görünür', async ({ page }) => {
    await openDecodePanel(page, SENT_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('with-pause');

    await expect(fieldRow(page, 'pause')).toHaveCount(1);
  });
});

test.describe('SENT sayfası — düzen', () => {
  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, SENT_DECODE_PATH);
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
