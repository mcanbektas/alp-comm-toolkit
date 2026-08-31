import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
  SAMPLE_COMPACT_GSD_TEXT,
  SAMPLE_GSD_DIAGNOSIS_TEXT_COUNT,
  SAMPLE_GSD_MODULE_COUNT,
  SAMPLE_GSD_PARAMETER_COUNT,
} from '../src/protocol-core/definitions/gsd/gsdFixture';
import { translations } from '../src/translations/all';

/**
 * GSD (PROFIBUS DP) tanım panelinin gerçek tarayıcı turu.
 *
 * Kanıtladığı şey: `profibus-dp` kaydının `definitions` sekmesi artık
 * "planlandı" bildirimi DEĞİL, gerçek bir cihazın modül/parametre tablosunu
 * basıyor — modüllerin giriş/çıkış uzunlukları kimlik baytlarından GERÇEKTEN
 * çözülüyor — ve hangi modülün takılı olduğunun bu dosyada YAZMADIĞI uyarısı
 * KOŞULSUZ görünüyor (`profibusDp.ts`in `userDataNeedsGsd` disiplini).
 *
 * Desen `xif-definitions.spec.ts`ten.
 */

const tr = translations.tr;

const DEFINITIONS_PATH =
  '/comm/industrial-automation/classic-fieldbus/profibus-dp?tab=definitions';
/** Regresyon bekçisi: LIN `definitions: ['ldf']` taşır ve LDF motoru HÂLÂ YOK. */
const NON_GSD_DEFINITIONS_PATH = '/comm/automotive/vehicle-network-protocols/lin?tab=definitions';

async function openPage(page: Page, path: string): Promise<string[]> {
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
  return consoleErrors;
}

async function openGsdPanel(page: Page, path: string = DEFINITIONS_PATH): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('gsd-panel')).toBeVisible();
  return consoleErrors;
}

function moduleRow(page: Page, reference: number): Locator {
  return page.locator(`[data-testid="gsd-module-row"][data-module-reference="${String(reference)}"]`);
}

function parameterRow(page: Page, reference: number): Locator {
  return page.locator(
    `[data-testid="gsd-parameter-row"][data-parameter-reference="${String(reference)}"]`,
  );
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** Hiçbir satır ham çeviri anahtarı basmamalı (dalga 1'de görülen kusur). */
async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  const panelText = (await page.getByTestId('gsd-panel').innerText()).trim();
  expect(panelText, 'panel ham çeviri anahtarı basıyor').not.toMatch(/definition\.gsd\./);
  for (const metin of await page.getByTestId('gsd-issue').allTextContents()) {
    expect(metin.trim(), 'gsd-issue çevrilmemiş anahtar basıyor').not.toMatch(
      /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
    );
  }
}

test('definitions sekmesi GSD paneliyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openGsdPanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PROFIBUS DP');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByTestId('gsd-load-failed')).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('ekran BOŞ açılmaz: gerçek cihazın GSD si yüklü gelir ve özetini basar', async ({ page }) => {
  await openGsdPanel(page);

  await expect(page.getByTestId('gsd-sample-notice')).toBeVisible();
  await expect(page.getByTestId('gsd-vendor')).toHaveText('Siemens AG A&D');
  await expect(page.getByTestId('gsd-model')).toHaveText('SINAMICS G120 CU240S DP F v3.00');
  await expect(page.getByTestId('gsd-order-number')).toHaveText('6SL3 244-0BA21-1PA0');
  await expect(page.getByTestId('gsd-ident-number')).toHaveText('0x8158');
  await expect(page.getByTestId('gsd-revision')).toHaveText('5');
  await expect(page.getByTestId('gsd-slave-family')).toHaveText('1@SINAMICS');
  await expect(page.getByTestId('gsd-station-kind')).toHaveText(tr['definition.gsd.station.modular']);
  await expect(page.getByTestId('gsd-module-count')).toHaveText(String(SAMPLE_GSD_MODULE_COUNT));
  await expect(page.getByTestId('gsd-max-input')).toHaveText('32');
  await expect(page.getByTestId('gsd-max-output')).toHaveText('32');
  await expect(page.getByTestId('gsd-device-info')).toContainText('DP-Slave SINAMICS G120');

  // Gerçek, değiştirilmemiş dosya: hiçbir uyarı ÇIKMAMALI.
  await expect(page.getByTestId('gsd-issue')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('modül tablosu kimlik baytlarını giriş/çıkış uzunluğuna ÇÖZEREK basar', async ({ page }) => {
  await openGsdPanel(page);

  await expect(page.getByTestId('gsd-module-row')).toHaveCount(SAMPLE_GSD_MODULE_COUNT);

  // "Standard telegram 20": 0xE1, 0xD5 → 2 word çıkış (4 B) + 6 word giriş (12 B).
  // Üreticinin kendi Info_Text i de "2 words output and 6 words input" diyor.
  const telegram20 = moduleRow(page, 2);
  await expect(telegram20).toContainText('Standard telegram 20');
  await expect(telegram20.getByTestId('gsd-module-config-bytes')).toHaveText('0xE1 0xD5');
  await expect(telegram20.getByTestId('gsd-module-input')).toHaveText('12');
  await expect(telegram20.getByTestId('gsd-module-output')).toHaveText('4');
  await expect(telegram20.getByTestId('gsd-module-layout')).toContainText(
    `${tr['definition.gsd.direction.output']} 2 × ${tr['definition.gsd.unit.word']} (4 B)`,
  );
  await expect(telegram20).toContainText('2 words output and 6 words input');

  await expectNoRawTranslationKeys(page);
});

test('ÖZEL kimlik biçimli modülde üreticiye özel baytlar ayrı basılır', async ({ page }) => {
  await openGsdPanel(page);

  // "PROFIsafe v1.x Module": 0xC6 → 6 bayt çıkış + 6 bayt giriş + 6 üretici baytı.
  const profisafe = moduleRow(page, 7);
  await expect(profisafe).toContainText('PROFIsafe v1.x Module');
  await expect(profisafe.getByTestId('gsd-module-input')).toHaveText('6');
  await expect(profisafe.getByTestId('gsd-module-output')).toHaveText('6');
  await expect(profisafe.getByTestId('gsd-module-layout')).toContainText(
    '0x05 0x05 0x0A 0x05 0x05 0x0A',
  );
});

test('parametre tablosu bit alanını ve PrmText seçeneğini birlikte basar', async ({ page }) => {
  await openGsdPanel(page);

  await expect(page.getByTestId('gsd-parameter-row')).toHaveCount(SAMPLE_GSD_PARAMETER_COUNT);

  // `ExtUserPrmData = 2 "F_SIL"` / `BitArea(2-3) 1 1-1` / `Prm_Text_Ref = 2`.
  const sil = parameterRow(page, 2);
  await expect(sil).toContainText('F_SIL');
  await expect(sil).toContainText(tr['definition.gsd.type.bitArea']);
  await expect(sil).toContainText('2-3');
  await expect(sil.getByTestId('gsd-parameter-choices')).toContainText('1 = SIL 2');

  // `Unsigned16 100 10-65535` — bit konumu YOK, aralık VAR.
  const watchdog = parameterRow(page, 7);
  await expect(watchdog).toContainText('F_WD_Time');
  await expect(watchdog).toContainText(tr['definition.gsd.type.unsigned16']);
  await expect(watchdog).toContainText('10 … 65535');
});

test('iletim hızı ve teşhis metni tabloları dosyadan gelir', async ({ page }) => {
  await openGsdPanel(page);

  await expect(page.getByTestId('gsd-baud-row')).toHaveCount(10);
  const fastest = page.locator('[data-testid="gsd-baud-row"][data-baud-label="12M"]');
  await expect(fastest).toContainText(tr['common.yes']);
  await expect(fastest).toContainText('200');

  await expect(page.getByTestId('gsd-diagnosis-row')).toHaveCount(SAMPLE_GSD_DIAGNOSIS_TEXT_COUNT);
  await expect(page.getByTestId('gsd-diagnosis-table')).toContainText('Wrong F destination address');
});

test('konfigürasyonun bu dosyada OLMADIĞI uyarısı KOŞULSUZ görünür', async ({ page }) => {
  await openGsdPanel(page);

  const notice = page.getByTestId('gsd-config-not-in-file');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(tr['definition.gsd.configurationNotInFile']);
  // Kimlik baytı çözümünün kaynağını anlatan not da basılmalı.
  await expect(page.getByTestId('gsd-identifier-note')).toBeVisible();
});

test('eski söz dizimli GERÇEK dosya içe aktarılınca panel hata basmaz', async ({ page }) => {
  await openGsdPanel(page);

  // Eurotherm TC: `Endmodule` küçük harfle, `GSD_Revision` yok, BASİT parametre biçimi.
  await page.getByTestId('gsd-import').setInputFiles({
    name: 'eurotherm_tc3001_pbslave.gsd',
    mimeType: 'text/plain',
    buffer: Buffer.from(SAMPLE_COMPACT_GSD_TEXT, 'utf8'),
  });

  await expect(page.getByTestId('gsd-vendor')).toHaveText('EUROTHERM Automation');
  await expect(page.getByTestId('gsd-ident-number')).toHaveText('0x0536');
  // Anahtar dosyada HİÇ YOK — panel boş göstergeyi basar, sıfır uydurmaz.
  await expect(page.getByTestId('gsd-revision')).toHaveText('—');
  await expect(page.getByTestId('gsd-module-count')).toHaveText('1');
  await expect(page.getByTestId('gsd-module-row')).toHaveCount(1);
  // 0x55, 0x63 → 6 word giriş (12 B) + 4 word çıkış (8 B).
  await expect(page.getByTestId('gsd-module-input')).toHaveText('12');
  await expect(page.getByTestId('gsd-module-output')).toHaveText('8');

  // Genişletilmiş parametre biçimi YOK: boş tablo yerine açıklama basılır.
  await expect(page.getByTestId('gsd-parameter-table')).toHaveCount(0);
  await expect(page.getByTestId('gsd-simple-parameters')).toContainText('0x11');
  // Teşhis metni de yok — boş tablo basılmaz.
  await expect(page.getByTestId('gsd-diagnosis-table')).toHaveCount(0);

  await expect(page.getByTestId('gsd-import-error')).toHaveCount(0);
  await expect(page.getByTestId('gsd-load-failed')).toHaveCount(0);
  await expect(page.getByTestId('gsd-sample-notice')).toHaveCount(0);
  await expect(page.getByTestId('gsd-issue')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('bozuk dosya ÖNCEKİ tabloyu silmez, hata mesajı basar', async ({ page }) => {
  await openGsdPanel(page);

  await page.getByTestId('gsd-import').setInputFiles({
    name: 'broken.gsd',
    mimeType: 'text/plain',
    buffer: Buffer.from('bu bir GSD dosyasi degil\n', 'utf8'),
  });

  const importError = page.getByTestId('gsd-import-error');
  await expect(importError).toBeVisible();
  await expect(importError).toHaveText(tr['definition.gsd.error.parseFailed']);
  // Önceki veritabanı AYAKTA kalır.
  await expect(page.getByTestId('gsd-module-row')).toHaveCount(SAMPLE_GSD_MODULE_COUNT);
  await expect(page.getByTestId('gsd-issue-list')).toContainText(
    tr['definition.gsd.issue.notGsd'],
  );
  await expectNoRawTranslationKeys(page);
});

test('GSD saymayan protokolde panel AÇILMAZ, "planlandı" bildirimi durur', async ({ page }) => {
  await openPage(page, NON_GSD_DEFINITIONS_PATH);

  await expect(page.getByTestId('gsd-panel')).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toBeVisible();
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGsdPanel(page);
  await expect(page.getByTestId('gsd-module-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('gsd-module-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
