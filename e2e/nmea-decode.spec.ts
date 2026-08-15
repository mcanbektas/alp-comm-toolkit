import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 9 dalga 2'nin gerçek tarayıcı turu — NMEA 0183 `decode` sekmesi.
 *
 * `modbus-decode.spec.ts`in birebir izlediği desen: birim testler `DecodePanel`i
 * sahte bir eklentiyle jsdom'da koşturuyor, bu dosya `/comm/...?tab=decode`
 * adresine gidince motorun GERÇEKTEN indirildiğini, GERÇEK parser'ın koştuğunu ve
 * ekranda spec §43'ün doğrulanmış GGA çerçevesinin alanları olduğunu kanıtlıyor.
 *
 * Seçiciler çeviri SÖZLÜĞÜNDEN kurulur; ekrandaki metin değişirse test de onunla
 * birlikte değişsin, ama yazım farkı yüzünden sessizce yeşil kalmasın.
 */

const tr = translations.tr;

/** Kanonik kayıt: motoru burada tanımlı. */
const CANONICAL_DECODE_PATH = '/comm/marine-navigation/nmea-family/nmea-0183?tab=decode';
/** Alias kayıt: kendi `pluginId`si YOK, motoru kanonik kayıttan devralır. */
const ALIAS_DECODE_PATH = '/comm/marine-navigation/gnss-corrections/gps-nmea?tab=decode';
/**
 * Regresyon bekçisi: aynı ailedeki, motorsuz kalan bir protokol. NMEA 0183
 * motoru bağlandıktan sonra bile motorsuz sayfa "planlandı" basmalı.
 *
 * Dalga 3a'da `nmea-family/nmea-2000`dan TAŞINDI: NMEA 2000 motoru bağlanınca
 * o sayfa artık "planlandı" basmıyor ve bekçi anlamını yitiriyordu (bkz.
 * `nmea2000-decode.spec.ts`). IEC 61162 bilinçli seçildi — aynı ailede (`decode`
 * sekmesi ve `planned` durumu doğrulandı), plan-fazlar.md'deki hiçbir dalga
 * listesinde geçmiyor (PSI5'in `modbus-decode.spec.ts`teki taşınma gerekçesiyle
 * aynı mantık).
 */
const PLANNED_DECODE_PATH = '/comm/marine-navigation/nmea-family/iec-61162?tab=decode';

/** Spec §43 fixture'ı — eklentinin ilk örnek çerçevesi de birebir budur. */
const FIXTURE_HEX =
  '24 47 50 47 47 41 2C 31 32 33 35 31 39 2C 34 38 30 37 2E 30 33 38 2C 4E 2C 30 31 31 33 31 2E 30 30 30 2C 45 2C 31 2C 30 38 2C 30 2E 39 2C 35 34 35 2E 34 2C 4D 2C 34 36 2E 39 2C 4D 2C 2C 2A 34 37';
/** Protokol/alan verisidir, çeviriye girmez. */
const GGA_FORMATTER_NAME = 'Global Positioning System Fix Data';

/**
 * Sayfayı açar ve tur boyunca konsola/sayfaya düşen her hatayı toplar.
 * Dinleyiciler `goto`dan ÖNCE bağlanır: `React.lazy` askısı ve eklenti
 * `import()`i ilk boyamada koşuyor, sonradan bağlanan dinleyici o penceredeki
 * hatayı hiç görmezdi.
 */
async function openPage(page: Page, path: string): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  // `/comm/` öneki ZORUNLU: `vite.config.ts` base'i `/comm/` yapıyor.
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  return consoleErrors;
}

/** Motoru olan sayfa: panel eklenti inene kadar "yükleniyor" basar, onu bekle. */
async function openDecodePanel(page: Page, path: string): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

/** Çözümleme tablosunda bir alanın satırı; `data-field-id` parser'ın alan kimliği. */
function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

/** Belge yatayda taşıyor mu — tablo/bayt görüntüleyici KENDİ kabında kaymalı. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test('decode sekmesi gerçek panelle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('NMEA 0183');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'nmea-0183');
  await expect(page.getByTestId('decode-plugin-name')).toHaveText('NMEA 0183');

  await expect(page.getByTestId('decode-loading')).toHaveCount(0);
  await expect(page.getByTestId('decode-load-error')).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('decode sekmesi "planlandı" bildirimi basmıyor', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByTestId('decode-no-parser')).toHaveCount(0);
});

test('örnek çerçeve varsayılan olarak yüklüdür ve ByteViewer bayt basar', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.getByLabel(tr['decode.example.label'])).toHaveValue('gga-fix');
  await expect(page.locator('#decode-hex')).toHaveValue(FIXTURE_HEX);
  await expect(page.getByTestId('decode-example-description')).toBeVisible();

  await expect(page.getByTestId('byte-viewer-empty')).toHaveCount(0);
  // Görüntüleyici 65 baytı birden çok satıra bölüyor; her satır ayrı bir
  // `byte-viewer-hex` span'ı, bu yüzden konteynerin TAMAMINA bakılır.
  await expect(page.getByTestId('byte-viewer')).toContainText('24 47 50 47 47');
  await expect(page.getByTestId('decode-byte-count')).toContainText('65');
});

test('spec §43 GGA cümlesi alan alan çözülür ve checksum geçerli görünür', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  // talker, sentence-formatter, 10 GGA alanı, checksum.
  await expect(page.getByTestId('decode-field-row')).toHaveCount(13);

  // Uyarı/hata metinleri ÇEVRİLMİŞ olmalı; ham çeviri anahtarı kalıntısı taranır
  // (dalga 1'de görülen kusur: `protocol.modbus.rtu.warning.roleInferredRequest`
  // ekranda ham basılmıştı).
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }

  await expect(fieldRow(page, 'talker').getByTestId('decode-field-raw')).toHaveText('GP');
  const formatterRow = fieldRow(page, 'sentence-formatter');
  await expect(formatterRow.getByTestId('decode-field-raw')).toHaveText('GGA');
  await expect(formatterRow.getByTestId('decode-field-physical')).toHaveText(GGA_FORMATTER_NAME);

  const latitudeRow = fieldRow(page, 'latitude');
  await expect(latitudeRow.getByTestId('decode-field-raw')).toHaveText('4807.038');
  await expect(latitudeRow.getByTestId('decode-field-physical')).toHaveText('48.1173 °');

  const longitudeRow = fieldRow(page, 'longitude');
  await expect(longitudeRow.getByTestId('decode-field-physical')).toHaveText('11.516667 °');

  await expect(fieldRow(page, 'fix-quality').getByTestId('decode-field-physical')).toHaveText(
    'GPS Fix',
  );
  await expect(fieldRow(page, 'satellite-count').getByTestId('decode-field-physical')).toHaveText(
    '8',
  );
  await expect(fieldRow(page, 'altitude').getByTestId('decode-field-physical')).toHaveText(
    '545.4 m',
  );

  const checksumRow = fieldRow(page, 'checksum');
  await expect(checksumRow.getByTestId('decode-field-raw')).toHaveText('47');
  await expect(checksumRow.getByTestId('decode-field-physical')).toHaveText('47');
  await expect(checksumRow.getByTestId('decode-field-validity')).toHaveText(tr['decode.status.valid']);
  await expect(checksumRow).toHaveAttribute('data-valid', 'true');

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
});

test('alan seçimi bayt görüntüleyicideki bölgeyi vurgular', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  // 10 baytlık latitude alanı görüntüleyicinin satır sınırını aştığı için birden
  // çok parçaya bölünüp basılır; hepsi AYNI `data-region-id`yi taşır.
  const latitudeRegion = page.locator('[data-region-id="latitude"]').first();
  await expect(latitudeRegion).toHaveAttribute('data-selected', 'false');

  await fieldRow(page, 'latitude').getByTestId('decode-field-select').click();

  await expect(latitudeRegion).toHaveAttribute('data-selected', 'true');
  await expect(fieldRow(page, 'latitude')).toHaveAttribute('data-selected', 'true');

  await latitudeRegion.click();
  await expect(latitudeRegion).toHaveAttribute('data-selected', 'false');
});

test('örnek değişince hex girdisi ve çözümleme birlikte yenilenir', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('rmc-fix');

  await expect(page.locator('#decode-hex')).not.toHaveValue(FIXTURE_HEX);
  await expect(fieldRow(page, 'status').getByTestId('decode-field-physical')).toHaveText('Active');
  await expect(
    fieldRow(page, 'speed-over-ground').getByTestId('decode-field-physical'),
  ).toHaveText('22.4 kn');
});

test('bozuk checksum örneği hata basar ama alanlar yine çözülür', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('gga-checksum-mismatch');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-validity')).toHaveText(
    tr['decode.status.invalid'],
  );

  // ...ama çerçeve YİNE alan alan çözülmüş olmalı (spec §47).
  await expect(page.getByTestId('decode-field-row')).toHaveCount(13);
  await expect(fieldRow(page, 'latitude').getByTestId('decode-field-physical')).toHaveText(
    '48.1173 °',
  );
});

test('generic envelope örneği (MWV) semantik ad olmadan ham alan listesi basar', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('mwv-generic-envelope');

  // talker + sentence-formatter + 5 ham alan + checksum.
  await expect(page.getByTestId('decode-field-row')).toHaveCount(8);
  await expect(fieldRow(page, 'field-1').getByTestId('decode-field-raw')).toHaveText('045.0');
  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.nmea.sentence.warning.genericFieldsOnly'],
  );
});

test('geçersiz hex girilince hata metni görünür ve baytlar temizlenir', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.locator('#decode-hex').fill('24 ZZ 00');

  const hexError = page.getByTestId('decode-hex-error');
  await expect(hexError).toBeVisible();
  await expect(hexError).toHaveText(tr['decode.error.invalidHex']);
  await expect(page.locator('#decode-hex')).toHaveAttribute('aria-invalid', 'true');

  await expect(page.getByTestId('byte-viewer-empty')).toBeVisible();
  await expect(page.getByTestId('decode-field-table')).toHaveCount(0);

  await page.locator('#decode-hex').fill(FIXTURE_HEX);
  await expect(hexError).toHaveCount(0);
  await expect(page.getByTestId('decode-field-row')).toHaveCount(13);
});

test('alias sayfası aynı motoru yükler', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page, ALIAS_DECODE_PATH);

  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'nmea-0183');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: tr['protocol.canonical'] })).toBeVisible();

  await expect(page.locator('#decode-hex')).toHaveValue(FIXTURE_HEX);
  await expect(page.getByTestId('decode-field-row')).toHaveCount(13);
  await expect(fieldRow(page, 'latitude').getByTestId('decode-field-physical')).toHaveText(
    '48.1173 °',
  );

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('aynı ailedeki eklentisi olmayan protokol hâlâ "planlandı" bildirimi basıyor', async ({ page }) => {
  await openPage(page, PLANNED_DECODE_PATH);

  await expect(page.getByText(tr['protocol.plannedNotice'])).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toHaveCount(0);
  await expect(page.getByTestId('decode-field-table')).toHaveCount(0);
  await expect(page.getByTestId('byte-viewer')).toBeVisible();
});

test('1440 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page, CANONICAL_DECODE_PATH);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();

  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(
    0,
  );
});

test('390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDecodePanel(page, CANONICAL_DECODE_PATH);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();

  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(
    0,
  );
});
