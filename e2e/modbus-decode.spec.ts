import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 9'un gerçek tarayıcı turu — protokol sayfasındaki `decode` sekmesi.
 *
 * Birim testler `DecodePanel`i sahte bir eklentiyle ve jsdom'da koşturuyor: ne
 * `registry.ts`in `import()` zinciri, ne `React.lazy` askısı, ne de katalogdaki
 * alias çözümü orada gerçekten çalışıyor. Bu dosyanın kanıtladığı şey tam olarak
 * bu: kullanıcı `/comm/...?tab=decode` adresine gittiğinde motor GERÇEKTEN
 * indiriliyor, GERÇEK parser koşuyor ve ekranda spec §43'ün doğrulanmış
 * çerçevesinin alanları var.
 *
 * Seçiciler çeviri SÖZLÜĞÜNDEN kurulur; ekrandaki metin değişirse test de
 * onunla birlikte değişsin, ama yazım farkı yüzünden sessizce yeşil kalmasın.
 */

const tr = translations.tr;

/** Kanonik kayıt: motoru burada tanımlı. */
const CANONICAL_DECODE_PATH = '/comm/industrial-automation/modbus/modbus-rtu?tab=decode';
/** Alias kayıt: kendi `pluginId`si YOK, motoru kanonik kayıttan devralır. */
const ALIAS_DECODE_PATH = '/comm/building-automation/modbus-building/modbus-rtu?tab=decode';
/**
 * Regresyon bekçisi: eklentisi olmayan bir protokol. Faz 9 "planlandı"
 * bildirimini yalnız motoru OLAN sayfadan kaldırdı; motorsuz sayfada bildirimin
 * durması gerekir, yoksa boş bir sekme basılmış olur (spec §50).
 */
const PLANNED_DECODE_PATH = '/comm/automotive/can-family/can-2-0a?tab=decode';

/** Spec §43 fixture'ı — eklentinin ilk örnek çerçevesi de birebir budur. */
const FIXTURE_HEX = '01 03 00 00 00 02 C4 0B';
/** Aynı çerçevenin CRC'si bir bit bozulmuş hâli: Received 0x0BC5, Calculated 0x0BC4. */
const BROKEN_CRC_HEX = '01 03 00 00 00 02 C5 0B';
/** Function code adı protokol verisidir, çeviriye girmez. */
const READ_HOLDING_REGISTERS = 'Read Holding Registers';

/**
 * Sayfayı açar ve tur boyunca konsola/sayfaya düşen her hatayı toplar.
 *
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
    // Dil tur boyunca sabit: seçiciler Türkçe sözlükten kuruluyor ve ortamın
    // tarayıcı dili turu etkilememeli.
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  // `/comm/` öneki ZORUNLU: `vite.config.ts` base'i `/comm/` yapıyor, önek
  // olmadan preview sunucusu 404 döner ve test uygulamayı hiç yüklemeden düşer.
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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Modbus RTU');
  // Panel hangi motoru yüklediğini kendi söylüyor: yanlış eklenti sessizce
  // "çalışıyor" görünmesin.
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'modbus-rtu');
  await expect(page.getByTestId('decode-plugin-name')).toHaveText('Modbus RTU');

  // Yükleme ve yükleme hatası dalları geride kalmış olmalı.
  await expect(page.getByTestId('decode-loading')).toHaveCount(0);
  await expect(page.getByTestId('decode-load-error')).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('decode sekmesi artık "planlandı" bildirimi basmıyor', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  // Eski davranışın gittiğinin kanıtı: motoru olan sayfada uyarı yalanlanmış olurdu.
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  // Eski sabit örnek çerçevenin alan etiketleri de gitmiş olmalı — panel artık
  // parser'ın ürettiği adları basıyor, kod içine gömülmüş "Payload"ı değil.
  await expect(page.getByText('Payload', { exact: true })).toHaveCount(0);
  // Motoru olmayan eklenti dalı da basılmamalı: parser var.
  await expect(page.getByTestId('decode-no-parser')).toHaveCount(0);
});

test('örnek çerçeve varsayılan olarak yüklüdür ve ByteViewer bayt basar', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  // Ekran BOŞ açılmaz (spec §50): ilk örnek daha ilk render'da girdide olmalı.
  await expect(page.getByLabel(tr['decode.example.label'])).toHaveValue(
    'read-holding-registers-request',
  );
  await expect(page.locator('#decode-hex')).toHaveValue(FIXTURE_HEX);
  await expect(page.getByTestId('decode-example-description')).toBeVisible();

  // Boş kabuk yeterli değil: görüntüleyici gerçekten bayt basmalı.
  await expect(page.getByTestId('byte-viewer-empty')).toHaveCount(0);
  await expect(page.getByTestId('byte-viewer-hex')).toContainText(FIXTURE_HEX);
  await expect(page.getByTestId('decode-byte-count')).toContainText('8');
});

test('01 03 00 00 00 02 C4 0B alan alan çözülür ve CRC geçerli görünür', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  // Adres + function code + start address + quantity + CRC.
  await expect(page.getByTestId('decode-field-row')).toHaveCount(5);

  // Uyarı/hata metinleri ÇEVRİLMİŞ olmalı. Tarayıcı turunda görülen kusur:
  // çözümleyiciler bu alanlara çeviri anahtarı koyuyor, panel ise ham basıyordu —
  // ekranda "protocol.modbus.rtu.warning.roleInferredRequest" duruyordu.
  // Sözlükte olmayan bir anahtar da bu bekçiden kaçamaz: nokta içeren ve
  // boşluk içermeyen her metin anahtar kalıntısıdır.
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }

  // Address = 1: ham değer hem onaltılık hem ondalık basılır.
  await expect(fieldRow(page, 'slave-address').getByTestId('decode-field-raw')).toHaveText(
    '0x1 (1)',
  );
  // Function = 3, semantik karşılığıyla birlikte.
  await expect(fieldRow(page, 'function-code').getByTestId('decode-field-raw')).toHaveText(
    '0x3 (3)',
  );
  await expect(fieldRow(page, 'function-code').getByTestId('decode-field-physical')).toHaveText(
    READ_HOLDING_REGISTERS,
  );

  // CRC: alınan ve hesaplanan yan yana, alan geçerli.
  const crcRow = fieldRow(page, 'crc');
  await expect(crcRow.getByTestId('decode-field-raw')).toHaveText('0xBC4 (3012)');
  await expect(crcRow.getByTestId('decode-field-physical')).toHaveText('3012');
  await expect(crcRow.getByTestId('decode-field-validity')).toHaveText(tr['decode.status.valid']);
  await expect(crcRow).toHaveAttribute('data-valid', 'true');

  // Geçerli çerçevede çerçeve hatası ve çözümleme başarısızlığı kartı olmamalı.
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
});

test('alan seçimi bayt görüntüleyicideki bölgeyi vurgular', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  const functionRegion = page.locator('[data-region-id="function-code"]');
  await expect(functionRegion).toHaveAttribute('data-selected', 'false');

  await fieldRow(page, 'function-code').getByTestId('decode-field-select').click();

  // Tablo → bayt yönü: alanların bölgelere çevrildiğinin (parsedFrameToRegions)
  // gerçek DOM'daki kanıtı.
  await expect(functionRegion).toHaveAttribute('data-selected', 'true');
  await expect(fieldRow(page, 'function-code')).toHaveAttribute('data-selected', 'true');

  // Bayt → tablo yönü: aynı bölgeye tıklamak seçimi kaldırır.
  await functionRegion.click();
  await expect(functionRegion).toHaveAttribute('data-selected', 'false');
});

test('örnek değişince hex girdisi ve çözümleme birlikte yenilenir', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page
    .getByLabel(tr['decode.example.label'])
    .selectOption('read-holding-registers-response');

  // 01 03 04 00 64 00 C8 BA 7A — ByteCount=4, Reg0=100, Reg1=200.
  await expect(page.locator('#decode-hex')).toHaveValue('01 03 04 00 64 00 C8 BA 7A');
  await expect(page.getByTestId('decode-byte-count')).toContainText('9');

  // Yanıt gövdesi istekten farklı çözülür: byte count alanı ancak yanıtta var.
  await expect(fieldRow(page, 'byte-count').getByTestId('decode-field-raw')).toHaveText('0x4 (4)');
  await expect(fieldRow(page, 'crc').getByTestId('decode-field-validity')).toHaveText(
    tr['decode.status.valid'],
  );
});

test('bozuk CRC hata basar ama alanlar yine çözülür', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.locator('#decode-hex').fill(BROKEN_CRC_HEX);

  // Hata görünür...
  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'crc-mismatch');
  await expect(frameError).toContainText(tr['studio.output.parseError.code.crcMismatch']);
  await expect(fieldRow(page, 'crc').getByTestId('decode-field-validity')).toHaveText(
    tr['decode.status.invalid'],
  );

  // ...ama çerçeve YİNE alan alan çözülmüş olmalı (spec §47): kullanıcı neyin
  // bozulduğunu ancak alanları görürse anlar.
  await expect(page.getByTestId('decode-field-row')).toHaveCount(5);
  await expect(fieldRow(page, 'slave-address').getByTestId('decode-field-raw')).toHaveText(
    '0x1 (1)',
  );
  await expect(fieldRow(page, 'function-code').getByTestId('decode-field-physical')).toHaveText(
    READ_HOLDING_REGISTERS,
  );
  // Alınan (0x0BC5) ile hesaplanan (0x0BC4) yan yana durur.
  await expect(fieldRow(page, 'crc').getByTestId('decode-field-raw')).toHaveText('0xBC5 (3013)');
  await expect(fieldRow(page, 'crc').getByTestId('decode-field-physical')).toHaveText('3012');
});

test('geçersiz hex girilince hata metni görünür ve baytlar temizlenir', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.locator('#decode-hex').fill('01 ZZ 00');

  const hexError = page.getByTestId('decode-hex-error');
  await expect(hexError).toBeVisible();
  await expect(hexError).toHaveText(tr['decode.error.invalidHex']);
  await expect(page.locator('#decode-hex')).toHaveAttribute('aria-invalid', 'true');

  // Yarım bayt da aynı yola düşer: tek hane sessizce yuvarlanamaz.
  await page.locator('#decode-hex').fill('010');
  await expect(hexError).toBeVisible();

  // Çözümlenecek bayt kalmadı: görüntüleyici boş, tablo yok.
  await expect(page.getByTestId('byte-viewer-empty')).toBeVisible();
  await expect(page.getByTestId('decode-field-table')).toHaveCount(0);

  // Geçerli girdiye dönünce ekran toparlanır.
  await page.locator('#decode-hex').fill(FIXTURE_HEX);
  await expect(hexError).toHaveCount(0);
  await expect(page.getByTestId('decode-field-row')).toHaveCount(5);
});

test('alias sayfası aynı motoru yükler', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page, ALIAS_DECODE_PATH);

  // Alias kaydın kendi `pluginId`si yok; motor kanonik kayda inilerek bulunur
  // (`resolvePluginId`). Bulunamasaydı sayfa "planlandı" basardı.
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'modbus-rtu');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  // Olgunluk rozeti de alias zincirinden gelir. Tarayıcı turunda görülen kusur:
  // alias sayfası çalışan bir çözümleyicinin üstünde "Planlandı" basıyordu,
  // çünkü `status` alias kaydının kendi verisinden okunuyordu.
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: tr['protocol.canonical'] })).toBeVisible();

  // Panel kanonik sayfadakiyle AYNI: örnek çerçeve ve alanlar birebir.
  await expect(page.locator('#decode-hex')).toHaveValue(FIXTURE_HEX);
  await expect(page.getByTestId('decode-field-row')).toHaveCount(5);
  await expect(fieldRow(page, 'function-code').getByTestId('decode-field-physical')).toHaveText(
    READ_HOLDING_REGISTERS,
  );

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('eklentisi olmayan protokol hâlâ "planlandı" bildirimi basıyor', async ({ page }) => {
  await openPage(page, PLANNED_DECODE_PATH);

  // Regresyon bekçisi: Faz 9 bildirimi yalnız motoru olan dalda kaldırdı.
  await expect(page.getByText(tr['protocol.plannedNotice'])).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toHaveCount(0);
  await expect(page.getByTestId('decode-field-table')).toHaveCount(0);

  // Boş kart basmak yasak: motorsuz sayfa yine sabit örnek çerçeveyi çizer.
  await expect(page.getByTestId('byte-viewer')).toBeVisible();
});

test('1440 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page, CANONICAL_DECODE_PATH);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();

  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});

test('390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDecodePanel(page, CANONICAL_DECODE_PATH);
  // Tablo `min-w-[40rem]` taşıyor: dar ekranda KENDİ kabında kaymalı, belgeyi
  // sürüklememeli. Ölçüden önce basıldığından emin ol.
  await expect(page.getByTestId('decode-field-table')).toBeVisible();

  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
