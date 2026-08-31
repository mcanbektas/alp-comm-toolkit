import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Protocol Converter'ın gerçek tarayıcı turu — spec §33.
 *
 * Birim testler zinciri parça parça sınıyor; burada ölçülen şey lazy inen
 * kaynak motorunun GERÇEK tarayıcıda çözüp eşlemeyi besleyebilmesi ve çıktının
 * ekrana basılması. jsdom'da `import()` anında çözülür, burada ayrı bir ağ
 * isteğidir.
 */

const tr = translations.tr;

async function openConverter(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  // `/comm/` öneki ZORUNLU — bkz. smoke.spec.ts.
  await page.goto('/comm/protocol-converter');
  await expect(page.getByRole('heading', { level: 1, name: tr['converter.title'] })).toBeVisible();
  return consoleErrors;
}

test('ekran boş açılmaz: §33 örneği çözülür ve gerçek MQTT paketi üretir', async ({ page }) => {
  const consoleErrors = await openConverter(page);

  // Modbus RTU kayıt yanıtı çözülür; Register 0 = 100, × 0.1 → 10.
  await expect(page.getByTestId('converter-field-count')).toBeVisible();
  await expect(page.getByTestId('converter-value-mapping-1')).toHaveText('10');

  // Paket baytlarını `mqtt` plugin'inin KENDİ encoder'ı yazdı: 30 17 00 13 …
  await expect(page.getByTestId('converter-packets')).toContainText('sensors/temperature: 30170013');

  expect(consoleErrors).toEqual([]);
});

test('hedef biçimi değişince çıktı da değişir', async ({ page }) => {
  const consoleErrors = await openConverter(page);
  await expect(page.getByTestId('converter-value-mapping-1')).toHaveText('10');

  await page.getByTestId('converter-destination').selectOption('json');
  await expect(page.getByTestId('converter-output-text')).toContainText('"sensors/temperature": 10');
  await expect(page.getByTestId('converter-packets')).toHaveCount(0);

  await page.getByTestId('converter-destination').selectOption('csv');
  await expect(page.getByTestId('converter-output-text')).toContainText('sensors/temperature\n10');

  expect(consoleErrors).toEqual([]);
});

test('dönüşüm ve hedef ad değişince değer anında güncellenir', async ({ page }) => {
  await openConverter(page);
  await expect(page.getByTestId('converter-value-mapping-1')).toHaveText('10');

  await page.getByTestId('converter-mapping-1-transform').selectOption('scaleOffset');
  await page.getByTestId('converter-mapping-1-addend').fill('5');
  await expect(page.getByTestId('converter-value-mapping-1')).toHaveText('15');

  await page.getByTestId('converter-mapping-1-transform').selectOption('none');
  await expect(page.getByTestId('converter-mapping-1-factor')).toHaveCount(0);
  await expect(page.getByTestId('converter-value-mapping-1')).toHaveText('100');
});

/**
 * Kaynak protokol değişince eski eşlemenin alanı kaybolur. Beklenen davranış
 * ÇÖKMEK değil, satırı sorun listesine indirmektir.
 */
test('kaynak protokol değişince kayıp alan sorun listesine iner', async ({ page }) => {
  const consoleErrors = await openConverter(page);
  await expect(page.getByTestId('converter-value-mapping-1')).toHaveText('10');

  await page.getByTestId('converter-source-protocol').selectOption('nmea-0183');

  // Yeni motorun kendi örnek çerçevesi tohumlanır ve çözülür…
  await expect(page.getByTestId('converter-hex')).not.toHaveValue('01 03 04 00 64 00 C8 BA 7A');
  await expect(page.getByTestId('converter-field-count')).toBeVisible();
  // …ama eski eşlemenin alanı orada yok.
  await expect(page.getByTestId('converter-issues')).toContainText('register-0');

  expect(consoleErrors).toEqual([]);
});

/**
 * Converter → Packet Builder köprüsü (2026-08-31). `converterHandoffStore`
 * ile jsdom'da da sınanabilir ama gezinme + hex'in Builder'ın kendi HEX
 * override'ına gerçekten uygulandığı yalnız burada, gerçek rota geçişiyle
 * kanıtlanır.
 */
test('paket Packet Builder\'a gönderilince hex override olarak uygulanır', async ({ page }) => {
  const consoleErrors = await openConverter(page);
  await expect(page.getByTestId('converter-packets')).toContainText('sensors/temperature: 30170013');

  await page.getByTestId('converter-send-to-builder-mapping-1').click();

  await expect(page.getByRole('heading', { level: 1, name: tr['builder.title'] })).toBeVisible();
  await expect(page.getByTestId('builder-handoff-applied')).toContainText('sensors/temperature');
  await expect(page.getByTestId('builder-preview-hex')).toContainText('30170013');

  expect(consoleErrors).toEqual([]);
});

test('yatay taşma yok', async ({ page }) => {
  await openConverter(page);
  await expect(page.getByTestId('converter-value-mapping-1')).toHaveText('10');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, 'sayfa yatayda taşıyor').toBeLessThanOrEqual(0);
});
