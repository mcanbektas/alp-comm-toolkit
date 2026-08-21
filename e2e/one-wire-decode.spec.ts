import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 11a'nın gerçek tarayıcı turu — 1-Wire.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (interfaces-framing/peripheral-buses/
 * one-wire) Hazır rozetiyle açıldığı; Read ROM/Match ROM'da Family Code + CRC
 * alanlarının doğru göründüğü; Skip/Search ROM gibi ROM ID taşımayan
 * komutlarda Family/Serial/CRC alanlarının HİÇ basılmadığı; bozuk CRC'nin
 * gerçek bir çerçeve hatası (ParseFailure DEĞİL) ürettiği; tanınmayan ROM
 * Command'ın yalnız uyarı ürettiği.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/interfaces-framing/peripheral-buses/one-wire?tab=decode';

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

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test.describe('1-Wire', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('1-Wire');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'one-wire');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Read ROM örneği Family Code + CRC alanlarını doğru basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('read-rom');

    const command = fieldRow(page, 'romCommand');
    await expect(command.getByTestId('decode-field-physical')).toHaveText('Read ROM');

    const family = fieldRow(page, 'familyCode');
    await expect(family.getByTestId('decode-field-physical')).toHaveText('0x28');

    const crc = fieldRow(page, 'crc');
    await expect(crc).toHaveAttribute('data-valid', 'true');

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Skip ROM örneği yalnız komut baytını basar, Family/Serial/CRC alanı hiç görünmez', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('skip-rom');

    const command = fieldRow(page, 'romCommand');
    await expect(command.getByTestId('decode-field-physical')).toHaveText('Skip ROM');

    await expect(fieldRow(page, 'familyCode')).toHaveCount(0);
    await expect(fieldRow(page, 'serialNumber')).toHaveCount(0);
    await expect(fieldRow(page, 'crc')).toHaveCount(0);

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('bozuk CRC gerçek bir çerçeve hatası basar (ParseFailure değil)', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('bad-crc');

    const crc = fieldRow(page, 'crc');
    await expect(crc).toHaveAttribute('data-valid', 'false');

    // Family Code bozuk CRC'ye rağmen yine yapısal olarak çözülür.
    const family = fieldRow(page, 'familyCode');
    await expect(family.getByTestId('decode-field-physical')).toHaveText('0x28');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).not.toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan ROM Command yalnız uyarı üretir, hata basmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unknown-command');

    const command = fieldRow(page, 'romCommand');
    await expect(command).toHaveAttribute('data-valid', 'false');
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      tr['protocol.oneWire.warning.unknownRomCommand'],
    );

    await expect(fieldRow(page, 'familyCode')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('1-Wire');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('unknown-command');
    await expect(page.getByTestId('decode-field-warning')).toContainText(
      translations.en['protocol.oneWire.warning.unknownRomCommand'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('read-rom');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
