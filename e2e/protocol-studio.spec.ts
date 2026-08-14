import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 7b'nin gerçek tarayıcı turu — Custom Protocol Studio.
 *
 * Birim testler jsdom'da koşar ve CSS'i hiç değerlendirmez; dört panelli geniş
 * düzenin gerçekten sığdığı, altı kod üreticisinin gerçekten metin bastığı ve
 * taslak→şema→çözümleme zincirinin gerçek React döngüsünde döndüğü tek yer
 * burası. Faz 8'de üç kusur ancak bu turda görülmüştü.
 */

const tr = translations.tr;

/** §9.6 örnek şemasının veri adları — çeviriye girmez, sabit kalır. */
const SAMPLE_SCHEMA_NAME = 'ALP Sensor Protocol';
const ADDRESS_FIELD_NAME = 'Device Address';

/**
 * Ekranı açar ve konsola düşen her hatayı toplar.
 *
 * Dil `addInitScript` ile sabitlenir: uygulama ilk açılışta tarayıcı dilini
 * yok sayıp Türkçe'ye düşse de, testin seçicileri sözlükten kurulduğu için
 * ortam dilinin turu etkilemediğini GARANTİ etmek gerekiyor.
 */
async function openStudio(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  // `/comm/` öneki ZORUNLU: `vite.config.ts` base'i `/comm/` yapıyor ve önek
  // olmadan preview sunucusu 404 döner — test uygulamayı hiç yüklemeden düşer.
  await page.goto('/comm/protocol-studio');
  await expect(page.getByRole('heading', { level: 1, name: tr['studio.title'] })).toBeVisible();
  return consoleErrors;
}

/** Alan listesindeki bir satırı adıyla seçer; `draftId` oturuma özgü olduğu için ada bakılır. */
function fieldRow(page: Page, name: string) {
  return page.locator('[data-testid^="field-select-"]').filter({ hasText: name });
}

/** Çözümleme tablosunda bir alanın satırı. */
function parsedRow(page: Page, fieldId: string) {
  return page.locator(`[data-testid="output-field-row"][data-field-id="${fieldId}"]`);
}

test('studio açılır, başlık görünür ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openStudio(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(tr['studio.title']);
  await expect(page.getByText(tr['studio.privacy'])).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('dört panelin dördü de basılır', async ({ page }) => {
  await openStudio(page);

  // Sol: alan listesi. Orta: çerçeve görünümü. Sağ: özellikler. Alt: çıktı.
  // `level: 2` şart — alan listesi özet kutusu da `studio.frame.title` başlığını
  // h3 olarak taşıyor ve adla arama iki düğüm bulurdu.
  await expect(page.getByRole('heading', { level: 2, name: tr['studio.fieldList.title'] })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: tr['studio.frame.title'] })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: tr['studio.section.properties'] })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: tr['studio.section.output'] })).toBeVisible();

  await expect(page.getByTestId('frame-view-panel')).toBeVisible();
  await expect(page.getByTestId('field-properties-panel')).toBeVisible();
  await expect(page.getByTestId('studio-output-section')).toBeVisible();
});

test('açılışta örnek şema yüklü ve örnek çerçeve çözümlenmiş gelir', async ({ page }) => {
  await openStudio(page);

  await expect(page.locator('#studio-meta-name')).toHaveValue(SAMPLE_SCHEMA_NAME);
  // §43'ün doğrulanmış çerçevesi: AA 05 10 03 34 12 7F 4F 55.
  await expect(page.locator('#studio-frame-hex')).toHaveValue('AA05100334127F4F55');

  // Alt panel gerçekten ÇÖZÜMLEMİŞ olmalı; boş bir tablo da "yeşil" görünürdü.
  await expect(page.getByTestId('output-parsed-empty')).toHaveCount(0);
  await expect(page.getByTestId('output-field-row')).toHaveCount(5);
  await expect(page.getByTestId('output-frame-status')).toHaveAttribute('data-valid', 'true');

  // Device Address = 0x05: ham değer hem hex hem ondalık basılır.
  await expect(parsedRow(page, 'address').getByTestId('output-field-raw')).toContainText('0x5');
  await expect(parsedRow(page, 'address').getByTestId('output-field-physical')).toHaveText('5');
  // Enum alanı etiketine çözülmüş olmalı — ham bayt değil.
  await expect(parsedRow(page, 'command').getByTestId('output-field-physical')).toHaveText(
    'Sensor Data',
  );
});

test('alan listesinden bir alan seçilince sağ panel dolar', async ({ page }) => {
  await openStudio(page);

  await expect(page.getByTestId('field-properties-empty')).toBeVisible();

  await fieldRow(page, ADDRESS_FIELD_NAME).click();

  await expect(page.getByTestId('field-properties-empty')).toHaveCount(0);
  await expect(page.locator('#field-props-name')).toHaveValue(ADDRESS_FIELD_NAME);
  await expect(page.locator('#field-props-id')).toHaveValue('address');
  await expect(page.locator('#field-props-type')).toHaveValue('uint8');
});

test('sağ panelde birim değişince alt paneldeki çözümleme güncellenir', async ({ page }) => {
  await openStudio(page);

  await fieldRow(page, ADDRESS_FIELD_NAME).click();

  const unitCell = parsedRow(page, 'address').locator('td').nth(4);
  // Birim yokken nötr tire basılır; değişikliğin gerçekten yansıdığını
  // görebilmek için önce başlangıç durumunu sabitliyoruz.
  await expect(unitCell).toHaveText('—');

  await page.locator('#field-props-unit').fill('V');

  // Zincirin tamamı koştu demektir: taslak → şema → yeniden çözümleme → tablo.
  await expect(unitCell).toHaveText('V');
});

test('altı üretilen çıktının sekmesi var ve C struct sekmesi gerçek kod basar', async ({ page }) => {
  await openStudio(page);

  // Çözümleme + Doğrulama + altı artefakt = sekiz sekme.
  await expect(page.getByTestId('output-tab')).toHaveCount(8);
  for (const key of [
    'studio.output.tab.jsonSchema',
    'studio.output.tab.cStruct',
    'studio.output.tab.cParser',
    'studio.output.tab.pythonParser',
    'studio.output.tab.typeScriptParser',
    'studio.output.tab.markdownDoc',
  ] as const) {
    await expect(page.getByRole('tab', { name: tr[key] })).toBeVisible();
  }

  await page.getByRole('tab', { name: tr['studio.output.tab.cStruct'] }).click();

  const code = page.getByTestId('output-artifact-code');
  await expect(code).toHaveAttribute('data-artifact-id', 'c-struct');
  await expect(code).toContainText('typedef struct');
  await expect(code).toContainText('uint8_t');
});

test('geçersiz hex girildiğinde hata metni görünür', async ({ page }) => {
  await openStudio(page);

  await page.locator('#studio-frame-hex').fill('AA ZZ 55');

  const error = page.locator('#studio-frame-hex-error');
  await expect(error).toBeVisible();
  await expect(error).toHaveText(tr['studio.error.invalidHex']);
  await expect(page.locator('#studio-frame-hex')).toHaveAttribute('aria-invalid', 'true');

  // Tek basamak da aynı yola düşer: yarım bayt sessizce yuvarlanamaz.
  await page.locator('#studio-frame-hex').fill('AAB');
  await expect(error).toBeVisible();
});

test('çözümle düğmesi sonucu duyurur', async ({ page }) => {
  await openStudio(page);

  const announcement = page.getByTestId('studio-analyze-announcement');
  await expect(announcement).toHaveAttribute('data-message-key', '');

  await page.getByRole('button', { name: tr['studio.action.analyze'] }).click();

  await expect(announcement).toHaveAttribute('data-message-key', 'studio.analyze.done');
  await expect(announcement).toHaveText(tr['studio.analyze.done']);
});

test('dört panelli geniş düzende yatay taşma yok', async ({ page }) => {
  await openStudio(page);

  // Tablolar ve bayt görüntüleyici KENDİ kabında kaymalı; belge gövdesi kaymamalı.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, 'sayfa yatayda taşıyor').toBeLessThanOrEqual(0);
});
