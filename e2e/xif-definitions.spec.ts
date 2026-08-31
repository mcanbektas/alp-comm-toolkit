import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { SAMPLE_MICROSERVER_XIF_TEXT } from '../src/protocol-core/definitions/xif/xifFixture';
import { translations } from '../src/translations/all';

/**
 * XIF (LonWorks) tanım panelinin gerçek tarayıcı turu.
 *
 * Kanıtladığı şey: `lonworks` kaydının `definitions` sekmesi artık "planlandı"
 * bildirimi DEĞİL, gerçek bir cihazın network variable / configuration property
 * tablosunu basıyor — ve tip bilgisinin telde DOĞRULANAMAYACAĞI uyarısı
 * KOŞULSUZ görünüyor (`lonworks.ts`in `nvTypeNotOnWire` disiplini).
 *
 * Desen `eds-definitions.spec.ts`ten.
 */

const tr = translations.tr;

const DEFINITIONS_PATH = '/comm/building-automation/lonworks/lonworks?tab=definitions';
/** Regresyon bekçisi: LIN `definitions: ['ldf']` taşır ve LDF motoru HÂLÂ YOK. */
const NON_XIF_DEFINITIONS_PATH = '/comm/automotive/vehicle-network-protocols/lin?tab=definitions';

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

async function openXifPanel(page: Page, path: string = DEFINITIONS_PATH): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('xif-panel')).toBeVisible();
  return consoleErrors;
}

function nvRow(page: Page, index: number): Locator {
  return page.locator(`[data-testid="xif-nv-row"][data-nv-index="${String(index)}"]`);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** Hiçbir satır ham çeviri anahtarı basmamalı (dalga 1'de görülen kusur). */
async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  const panelText = (await page.getByTestId('xif-panel').innerText()).trim();
  expect(panelText, 'panel ham çeviri anahtarı basıyor').not.toMatch(/definition\.xif\./);
  for (const metin of await page.getByTestId('xif-issue').allTextContents()) {
    expect(metin.trim(), 'xif-issue çevrilmemiş anahtar basıyor').not.toMatch(
      /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
    );
  }
}

test('definitions sekmesi XIF paneliyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openXifPanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('LonWorks');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByTestId('xif-load-failed')).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('ekran BOŞ açılmaz: gerçek cihazın XIF i yüklü gelir ve özetini basar', async ({ page }) => {
  await openXifPanel(page);

  await expect(page.getByTestId('xif-sample-notice')).toBeVisible();
  await expect(page.getByTestId('xif-file-name')).toHaveText('WNC-FT-B-303.XIF');
  await expect(page.getByTestId('xif-program-id')).toHaveText('80:00:22:15:00:0A:04:05');
  await expect(page.getByTestId('xif-format-version')).toHaveText('4.400');
  await expect(page.getByTestId('xif-nv-count')).toHaveText('28');
  await expect(page.getByTestId('xif-config-property-count')).toHaveText('6');
  await expect(page.getByTestId('xif-message-tag-count')).toHaveText('0');
  await expect(page.getByTestId('xif-channel-bit-rate')).toHaveText('78125');
  await expect(page.getByTestId('xif-device-documentation')).toHaveText(
    'WattNode Power/Energy Sensor',
  );
  // Gerçek, değiştirilmemiş dosya: hiçbir uyarı ÇIKMAMALI.
  await expect(page.getByTestId('xif-issue')).toHaveCount(0);
});

test('network variable tablosu 28 kaydı alan alan basar', async ({ page }) => {
  await openXifPanel(page);

  await expect(page.getByTestId('xif-nv-row')).toHaveCount(28);

  // Yapı tipli çıkış NV si: SNVT #93 skaler tabloda YOK, indeks yine de basılır.
  const status = nvRow(page, 1);
  await expect(status).toContainText('nvoStatus');
  await expect(status).toContainText(tr['definition.xif.direction.output']);
  await expect(status).toContainText('#93');
  await expect(status).toContainText('Object status');

  // Tabloda karşılığı OLAN indeks ADIYLA birlikte basılır.
  const calSel = nvRow(page, 3);
  await expect(calSel).toContainText('nviCalSel');
  await expect(calSel).toContainText(tr['definition.xif.direction.input']);
  await expect(calSel).toContainText('#8 · SNVT_count');

  await expectNoRawTranslationKeys(page);
});

test('configuration property tablosu altı CPNV yi ayrı basar', async ({ page }) => {
  await openXifPanel(page);

  await expect(page.getByTestId('xif-config-property-row')).toHaveCount(6);
  const demandPeriod = page.locator('[data-testid="xif-config-property-row"][data-nv-index="38"]');
  await expect(demandPeriod).toContainText('nciDemPerMins');
  await expect(demandPeriod).toContainText('#8 · SNVT_count');

  // Konfigürasyon sınıfı, NV tablosunda da işaretli.
  await expect(nvRow(page, 38)).toContainText(tr['definition.xif.class.config']);
  await expect(nvRow(page, 1)).toContainText(tr['definition.xif.class.network']);
});

test('SNVT tipinin telde DOĞRULANAMAYACAĞI uyarısı KOŞULSUZ görünür', async ({ page }) => {
  await openXifPanel(page);

  const notice = page.getByTestId('xif-type-not-on-wire');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(tr['definition.xif.typeNotOnWire']);
  // Skaler tablonun kapsam notu da basılmalı — "adı yok" ≠ "tipi tanımsız".
  await expect(page.getByTestId('xif-snvt-table-note')).toBeVisible();
});

test('dosyada olmayan bölümler için BOŞ TABLO basılmaz', async ({ page }) => {
  await openXifPanel(page);

  // WattNode dosyası message tag ve FILE kaydı TAŞIMIYOR.
  await expect(page.getByTestId('xif-message-tag-table')).toHaveCount(0);
  await expect(page.getByTestId('xif-config-file-table')).toHaveCount(0);
});

test('sıfır NV taşıyan GERÇEK dosya içe aktarılınca panel hata basmaz', async ({ page }) => {
  await openXifPanel(page);

  // `izot/shortstack` microserver XIF i: geçerli ama sıfır network variable.
  await page.getByTestId('xif-import').setInputFiles({
    name: 'SS430_FT6050_SYS20000kHz.xif',
    mimeType: 'text/plain',
    buffer: Buffer.from(SAMPLE_MICROSERVER_XIF_TEXT, 'utf8'),
  });

  await expect(page.getByTestId('xif-program-id')).toHaveText('53:34:33:30:30:42:42:30');
  await expect(page.getByTestId('xif-nv-count')).toHaveText('0');
  await expect(page.getByTestId('xif-import-error')).toHaveCount(0);
  await expect(page.getByTestId('xif-load-failed')).toHaveCount(0);
  await expect(page.getByTestId('xif-sample-notice')).toHaveCount(0);
  // Sıfır NV bir HATA DEĞİLDİR: uyarı listesi de boş kalmalı.
  await expect(page.getByTestId('xif-issue')).toHaveCount(0);
  await expect(page.getByTestId('xif-nv-row')).toHaveCount(0);
});

test('bozuk dosya ÖNCEKİ tabloyu silmez, hata mesajı basar', async ({ page }) => {
  await openXifPanel(page);

  await page.getByTestId('xif-import').setInputFiles({
    name: 'broken.xif',
    mimeType: 'text/plain',
    buffer: Buffer.from('bu bir XIF dosyasi degil\n', 'utf8'),
  });

  const importError = page.getByTestId('xif-import-error');
  await expect(importError).toBeVisible();
  await expect(importError).toHaveText(tr['definition.xif.error.parseFailed']);
  // Önceki veritabanı AYAKTA kalır.
  await expect(page.getByTestId('xif-nv-row')).toHaveCount(28);
  // İKİ uyarı birden çıkar: 1. satır biçimi bozuk VE başlık kurulamadı.
  const issues = page.getByTestId('xif-issue-list');
  await expect(issues).toContainText(tr['definition.xif.issue.malformedFileLine']);
  await expect(issues).toContainText(tr['definition.xif.issue.noHeader']);
  await expectNoRawTranslationKeys(page);
});

test('XIF saymayan protokolde panel AÇILMAZ, "planlandı" bildirimi durur', async ({ page }) => {
  await openPage(page, NON_XIF_DEFINITIONS_PATH);

  await expect(page.getByTestId('xif-panel')).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toBeVisible();
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openXifPanel(page);
  await expect(page.getByTestId('xif-nv-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('xif-nv-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
