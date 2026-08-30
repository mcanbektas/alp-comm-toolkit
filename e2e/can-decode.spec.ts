import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 9 dalga 3'ün gerçek tarayıcı turu — CAN ailesinin dört varyantı.
 *
 * Birim testler parser'ları saf TypeScript olarak koşturuyor; bu dosyanın
 * kanıtladığı şey kullanıcı `/comm/automotive/can-family/...?tab=decode`
 * adresine gittiğinde motorun GERÇEKTEN indirildiği, GERÇEK parser'ın koştuğu
 * ve SocketCAN bayt düzeninin ekranda doğru alanlara ayrıldığıdır.
 *
 * Seçiciler çeviri SÖZLÜĞÜNDEN kurulur; ekrandaki metin değişirse test de
 * onunla birlikte değişsin, ama yazım farkı yüzünden sessizce yeşil kalmasın.
 */

const tr = translations.tr;

const BASE_DECODE_PATH = '/comm/automotive/can-family/can-2-0a?tab=decode';
const EXTENDED_DECODE_PATH = '/comm/automotive/can-family/can-2-0b?tab=decode';
const FD_DECODE_PATH = '/comm/automotive/can-family/can-fd?tab=decode';
const XL_DECODE_PATH = '/comm/automotive/can-family/can-xl?tab=decode';

/** `struct can_frame`: can_id little-endian 0x00000321, DLC 8, sekiz veri baytı. */
const BASE_FIXTURE_HEX = '21 03 00 00 08 00 00 00 10 27 00 64 12 34 FF 00';
/** Aynı düzende 0x18F00401 + EFF bayrağı → 0x98F00401 → 01 04 F0 98. */
const EXTENDED_FIXTURE_HEX = '01 04 F0 98 08 00 00 00 FF FF FF 68 13 FF FF FF';

/** Protokol/alan terimleri veridir, çeviriye girmez. */
const BASE_FORMAT_LABEL = 'Base / 11-bit';
const EXTENDED_FORMAT_LABEL = 'Extended / 29-bit';

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

async function openDecodePanel(page: Page, path: string): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** Hiçbir tanı satırı ham çeviri anahtarı basmamalı (dalga 1'de görülen kusur). */
async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test('dört CAN varyantı da gerçek panelle açılır ve konsola hata basmaz', async ({ page }) => {
  const variants = [
    { path: BASE_DECODE_PATH, pluginId: 'can-2-0a', title: 'CAN 2.0A' },
    { path: EXTENDED_DECODE_PATH, pluginId: 'can-2-0b', title: 'CAN 2.0B' },
    { path: FD_DECODE_PATH, pluginId: 'can-fd', title: 'CAN FD' },
    { path: XL_DECODE_PATH, pluginId: 'can-xl', title: 'CAN XL' },
  ];

  for (const variant of variants) {
    const consoleErrors = await openDecodePanel(page, variant.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(variant.title);
    await expect(page.getByTestId('decode-panel')).toHaveAttribute(
      'data-plugin-id',
      variant.pluginId,
    );
    await expect(page.getByTestId('decode-loading')).toHaveCount(0);
    await expect(page.getByTestId('decode-load-error')).toHaveCount(0);
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
    expect(
      consoleErrors,
      `${variant.pluginId} konsol hataları: ${consoleErrors.join(' | ')}`,
    ).toEqual([]);
  }
});

test('CAN 2.0A base çerçevesi alan alan çözülür', async ({ page }) => {
  await openDecodePanel(page, BASE_DECODE_PATH);

  await expect(page.locator('#decode-hex')).toHaveValue(BASE_FIXTURE_HEX);
  await expect(page.getByTestId('decode-byte-count')).toContainText('16');

  // can-id, dlc, rtr, ide, data.
  await expect(page.getByTestId('decode-field-row')).toHaveCount(5);
  await expectNoRawTranslationKeys(page);

  // Identifier LITTLE-ENDIAN okunuyor: 21 03 00 00 → 0x321, big-endian
  // okunsaydı 0x21030000 çıkardı.
  await expect(fieldRow(page, 'can-id').getByTestId('decode-field-raw')).toHaveText('0x321 (801)');
  await expect(fieldRow(page, 'can-id').getByTestId('decode-field-physical')).toHaveText(
    BASE_FORMAT_LABEL,
  );
  await expect(fieldRow(page, 'dlc').getByTestId('decode-field-raw')).toHaveText('0x8 (8)');
  await expect(fieldRow(page, 'ide').getByTestId('decode-field-physical')).toHaveText('Base');
  await expect(fieldRow(page, 'rtr').getByTestId('decode-field-physical')).toHaveText('Data Frame');

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
});

test('CAN 2.0B extended çerçevesi 29-bit identifier’ı çözer ve üst katman adaylarını uyarır', async ({
  page,
}) => {
  await openDecodePanel(page, EXTENDED_DECODE_PATH);

  await expect(page.locator('#decode-hex')).toHaveValue(EXTENDED_FIXTURE_HEX);
  // EFF bayrağı identifier'dan ayrılmalı: 0x98F00401 değil 0x18F00401.
  await expect(fieldRow(page, 'can-id').getByTestId('decode-field-raw')).toHaveText(
    '0x18F00401 (418382849)',
  );
  await expect(fieldRow(page, 'can-id').getByTestId('decode-field-physical')).toHaveText(
    EXTENDED_FORMAT_LABEL,
  );

  // Spec: "29-bit ID tek başına protokol kanıtı değildir".
  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.can.frame.warning.higherLayerCandidates'],
  );
  await expectNoRawTranslationKeys(page);
});

test('biçim uyuşmazlığı hata değil uyarı basar ve çerçeve yine çözülür', async ({ page }) => {
  await openDecodePanel(page, EXTENDED_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('extended-base-frame-mismatch');

  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.can.frame.warning.baseOnExtendedPage'],
  );
  // Uyarıya rağmen çerçeve geçerli ve alanlar dolu.
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expect(fieldRow(page, 'can-id').getByTestId('decode-field-raw')).toHaveText('0x123 (291)');
  await expectNoRawTranslationKeys(page);
});

test('CAN FD uzunluk alanı gerçek bayt sayısını ve DLC kodunu YAN YANA gösterir', async ({
  page,
}) => {
  await openDecodePanel(page, FD_DECODE_PATH);

  // can-id, payload-length, rtr, ide, fdf, brs, esi, data.
  await expect(page.getByTestId('decode-field-row')).toHaveCount(8);

  const lengthRow = fieldRow(page, 'payload-length');
  await expect(lengthRow.getByTestId('decode-field-raw')).toHaveText('0xC (12)');
  // Kod bayt sayısı DEĞİLDİR: 9 kodu tam olarak 12 bayt demektir.
  await expect(lengthRow.getByTestId('decode-field-physical')).toHaveText('DLC 9');

  await expect(fieldRow(page, 'fdf').getByTestId('decode-field-physical')).toHaveText(
    'CAN FD Frame',
  );
  await expect(fieldRow(page, 'brs').getByTestId('decode-field-physical')).toHaveText(
    'Bit Rate Switched',
  );
  await expect(fieldRow(page, 'esi').getByTestId('decode-field-physical')).toHaveText(
    'Error Active',
  );
  await expectNoRawTranslationKeys(page);
});

test('CAN FD 64 baytlık azami yükü DLC 15 olarak çözer', async ({ page }) => {
  await openDecodePanel(page, FD_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('fd-max-payload');

  await expect(fieldRow(page, 'payload-length').getByTestId('decode-field-physical')).toHaveText(
    'DLC 15',
  );
  await expect(page.getByTestId('decode-byte-count')).toContainText('72');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('CAN FD kanonik olmayan uzunlukta uyarır ama veriyi yine gösterir', async ({ page }) => {
  await openDecodePanel(page, FD_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('fd-non-canonical-length');

  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.can.frame.warning.nonCanonicalFdLength'],
  );
  await expect(fieldRow(page, 'payload-length')).toHaveAttribute('data-valid', 'false');
  // Uyarıya rağmen veri alanı basılmış olmalı (spec §47).
  await expect(fieldRow(page, 'data')).toHaveCount(1);
  await expectNoRawTranslationKeys(page);
});

test('CAN XL Priority ID ile Acceptance Field’ı AYRI alanlar olarak basar', async ({ page }) => {
  await openDecodePanel(page, XL_DECODE_PATH);

  // priority-id, vcid, flags, sdt, payload-length, acceptance-field, data.
  await expect(page.getByTestId('decode-field-row')).toHaveCount(7);

  // CAN XL'in klasik CAN'den kavramsal farkı tam burada görünür olmalı.
  await expect(fieldRow(page, 'priority-id').getByTestId('decode-field-raw')).toHaveText(
    '0x123 (291)',
  );
  await expect(fieldRow(page, 'acceptance-field').getByTestId('decode-field-physical')).toHaveText(
    '0xDEADBEEF',
  );
  await expect(fieldRow(page, 'vcid').getByTestId('decode-field-physical')).toHaveText('0x01');
  await expect(fieldRow(page, 'flags').getByTestId('decode-field-physical')).toHaveText('XLF');

  // Bekçi — tarayıcı turunda görülen kusur: Priority ID ve VCID ikisi de `prio`
  // alanının dört baytını sahipleniyordu, VCID listede sonra geldiği için
  // Priority ID'nin bölgesi tamamen örtülüyor ve satıra tıklamak hiçbir baytı
  // vurgulamıyordu. İkisinin de kendi bölgesi olmalı.
  await expect(page.locator('[data-region-id="priority-id"]')).toHaveCount(1);
  await expect(page.locator('[data-region-id="vcid"]')).toHaveCount(1);
  await expectNoRawTranslationKeys(page);
});

test('CAN XL büyük yükü çizer ve dar ekranda belgeyi taşırmaz', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDecodePanel(page, XL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('xl-large-payload');
  await expect(page.getByTestId('decode-byte-count')).toContainText('268');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();

  // 256 baytlık yük görüntüleyicinin KENDİ kabında kaymalı.
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(
    0,
  );
});

test('CAN ID satırı bayt görüntüleyicide KENDİ bölgesini vurgular', async ({ page }) => {
  await openDecodePanel(page, BASE_DECODE_PATH);

  // Bekçi — tarayıcı turunda görülen kusur: RTR ve IDE alanlarına identifier'ın
  // dört baytı verilmişti, bölge adaptörü çakışmada listede sonrakini
  // kazandırdığı için `can-id` bölgesi tamamen örtülüyor ve bu tıklama hiçbir
  // baytı vurgulamıyordu. Bayraklar artık yalnız 3. baytı kaplıyor.
  const canIdRegion = page.locator('[data-region-id="can-id"]').first();
  await expect(canIdRegion).toHaveAttribute('data-selected', 'false');

  await fieldRow(page, 'can-id').getByTestId('decode-field-select').click();

  await expect(canIdRegion).toHaveAttribute('data-selected', 'true');
  await expect(fieldRow(page, 'can-id')).toHaveAttribute('data-selected', 'true');

  await canIdRegion.click();
  await expect(canIdRegion).toHaveAttribute('data-selected', 'false');
});

test('alan seçimi bayt görüntüleyicideki bölgeyi vurgular', async ({ page }) => {
  await openDecodePanel(page, BASE_DECODE_PATH);

  const dataRegion = page.locator('[data-region-id="data"]').first();
  await expect(dataRegion).toHaveAttribute('data-selected', 'false');

  await fieldRow(page, 'data').getByTestId('decode-field-select').click();

  await expect(dataRegion).toHaveAttribute('data-selected', 'true');
  await expect(fieldRow(page, 'data')).toHaveAttribute('data-selected', 'true');

  await dataRegion.click();
  await expect(dataRegion).toHaveAttribute('data-selected', 'false');
});

test('geçersiz hex girilince hata metni görünür ve baytlar temizlenir', async ({ page }) => {
  await openDecodePanel(page, BASE_DECODE_PATH);

  await page.locator('#decode-hex').fill('21 ZZ 00');
  const hexError = page.getByTestId('decode-hex-error');
  await expect(hexError).toBeVisible();
  await expect(hexError).toHaveText(tr['decode.error.invalidHex']);
  await expect(page.getByTestId('byte-viewer-empty')).toBeVisible();
  await expect(page.getByTestId('decode-field-table')).toHaveCount(0);

  await page.locator('#decode-hex').fill(BASE_FIXTURE_HEX);
  await expect(hexError).toHaveCount(0);
  await expect(page.getByTestId('decode-field-row')).toHaveCount(5);
});

test('1440 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page, FD_DECODE_PATH);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();

  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(
    0,
  );
});
