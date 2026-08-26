import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 16c'nin gerçek tarayıcı turu — IEC 61162 (`marine-navigation`
 * domain'ini kapatan kayıt).
 *
 * Motor birim testlerde alan alan doğrulandı; bu dosya motoru değil,
 * **kapsam kararının ve iki checksum ayrımının EKRANDA görünür olduğunu** sınar:
 *   · rozet "Kısmi" ve özet neyin ÇÖZÜLMEDİĞİNİ açıkça yazıyor mu,
 *   · TAG ve cümle checksum'ları AYRI AYRI PASS basıyor mu,
 *   · TAG'inki bozulunca cümleninki PASS kalıyor mu (kapsam ayrımının kanıtı),
 *   · `transportProfile` `-1`e çevrilince yönlendirme tablosu ve `nmea-0183`
 *     bağlantısı geliyor mu,
 *   · `transmissionGroup` seçilince "telden okunmadı" uyarısı beliriyor mu.
 * Desen `seatalk-decode.spec.ts` (16b) ve `ads-b-decode.spec.ts`ten.
 */

const tr = translations.tr;
const DECODE_PATH = '/comm/marine-navigation/nmea-family/iec-61162?tab=decode';

/** FKIE `iec-61162-450-nmea.pcap` yakalamasının 40 baytı — varsayılan örnek. */
const DEFAULT_EXAMPLE_HEX =
  '55 64 50 62 43 00 5C 73 3A 48 45 30 30 30 31 2A 34 35 5C 24 48 45 52 4F 54 2C 2B 30 30 30 2E 30 35 2C 41 2A 33 35 0D 0A';

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });
  await page.goto(DECODE_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

function fieldName(page: Page, fieldId: string): Locator {
  return fieldRow(page, fieldId).getByTestId('decode-field-select');
}

/** Alan uyarısı AYRI bir `<tr>`dedir — satırın içinden değil KÖKTEN aranır. */
function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

/** Çerçeve uyarısı birden çok olduğu için strict-mode ihlaline düşmemek adına süzülür. */
function frameWarning(page: Page, text: string): Locator {
  return page.getByTestId('decode-frame-warning').filter({ hasText: text });
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

test('sayfa Kısmi rozetiyle açılır, özet kapsam dışını AÇIKÇA yazar, konsola hata basmaz', async ({
  page,
}) => {
  const consoleErrors = await openDecodePanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('IEC 61162');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'iec-61162');
  await expect(page.getByTestId('decode-plugin-name')).toHaveText('IEC 61162');
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  // Katalog özeti (protokol VERİSİDİR, çevrilmez) çözüleni, yönlendirileni ve
  // HİÇ olmayanı AYRI AYRI sayar — `seatalk-decode.spec.ts` ile aynı ölçüt.
  const summary = page.locator('p', { hasText: 'NOT AVAILABLE AT ALL' }).first();
  await expect(summary).toContainText('DECODED');
  await expect(summary).toContainText('ROUTED, NOT DECODED');
  await expect(summary).toContainText('NOT AVAILABLE AT ALL');
  await expect(summary).toContainText('RaUdP/RpUdP/RrUdP');
  await expect(summary).toContainText('NOT in the payload at all');

  // Varsayılan örnek FKIE'nin gerçek yakalamasıdır ve İLK render'da girdide.
  await expect(page.locator('#decode-hex')).toHaveValue(DEFAULT_EXAMPLE_HEX);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('TAG ve cümle checksum’ları AYRI AYRI PASS basar, kapsamları farklı görünür', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(fieldName(page, 'magic-token')).toHaveText('Magic Token');
  await expect(fieldRow(page, 'magic-token').getByTestId('decode-field-physical')).toHaveText(
    'UdPbC + NUL',
  );

  await expect(fieldName(page, 'tag-1-1-s')).toHaveText('TAG 1.1 · s: Source (SFI)');
  // İki checksum, İKİ FARKLI kapsam: 8 bayt (`\`…`*`) ve 15 bayt (`$`…`*`).
  await expect(fieldRow(page, 'tag-1-1-checksum').getByTestId('decode-field-physical')).toHaveText(
    'PASS (covers 8 B)',
  );
  await expect(
    fieldRow(page, 'sentence-1-checksum').getByTestId('decode-field-physical'),
  ).toHaveText('PASS (covers 15 B)');
  await expect(fieldRow(page, 'tag-1-1-checksum')).toHaveAttribute('data-valid', 'true');
  await expect(fieldRow(page, 'sentence-1-checksum')).toHaveAttribute('data-valid', 'true');

  await expect(fieldRow(page, 'sentence-1-formatter').getByTestId('decode-field-physical')).toHaveText(
    'Rate of Turn',
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('TAG checksum’ı bozulunca cümleninki PASS KALIR (kapsam ayrımının ekrandaki kanıtı)', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'tag-checksum-corrupt');

  await expect(fieldRow(page, 'tag-1-1-checksum').getByTestId('decode-field-physical')).toContainText(
    'FAIL',
  );
  await expect(fieldRow(page, 'tag-1-1-checksum')).toHaveAttribute('data-valid', 'false');
  await expect(fieldWarning(page, 'tag-1-1-checksum')).toHaveText(
    tr['protocol.iec61162.field.checksumMismatch'],
  );

  // Cümle ETKİLENMEZ.
  await expect(
    fieldRow(page, 'sentence-1-checksum').getByTestId('decode-field-physical'),
  ).toHaveText('PASS (covers 15 B)');
  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
    'data-error-code',
    'checksum-mismatch',
  );

  // Tersi de doğru: cümleninki bozulunca TAG PASS kalır.
  await selectExample(page, 'sentence-checksum-corrupt');
  await expect(fieldRow(page, 'tag-1-1-checksum').getByTestId('decode-field-physical')).toHaveText(
    'PASS (covers 8 B)',
  );
  await expect(
    fieldRow(page, 'sentence-1-checksum').getByTestId('decode-field-physical'),
  ).toContainText('FAIL');
});

test('sekiz cümlelik gerçek yakalama tek düz tabloda çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'multi-sentence-navd');

  await expect(fieldRow(page, 'sentence-1-formatter').getByTestId('decode-field-raw')).toContainText(
    'GLL',
  );
  await expect(fieldRow(page, 'sentence-8-formatter').getByTestId('decode-field-raw')).toContainText(
    'OSD',
  );
  // `c:` ölçeği ÇIKARIMDIR ve alan bunu kendi uyarısıyla söyler.
  await expect(fieldRow(page, 'tag-1-1-c').getByTestId('decode-field-physical')).toContainText(
    'inferred scale: ms',
  );
  await expect(fieldWarning(page, 'tag-1-1-c')).toHaveText(
    tr['protocol.iec61162.field.timestampScaleInferred'],
  );

  // Sekiz cümlenin alan id'leri çakışsaydı satır sayısı düşerdi.
  const rows = page.locator('[data-testid="decode-field-row"]');
  expect(await rows.count()).toBeGreaterThan(60);
});

test('`transportProfile` -1’e çevrilince çerçeve çözülmez, yönlendirme tablosu gelir', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(page.locator('#decode-option-transportProfile')).toBeVisible();
  await page.locator('#decode-option-transportProfile').selectOption('61162-1');

  // Çerçeve alanları KAYBOLUR — bu görünüm çözmez, yönlendirir.
  await expect(fieldRow(page, 'magic-token')).toHaveCount(0);
  await expect(fieldRow(page, 'sentence-1-checksum')).toHaveCount(0);
  await expect(
    frameWarning(page, tr['protocol.iec61162.warning.frameNotDecodedInRoutingProfile']),
  ).toHaveCount(1);

  // Kullanıcıyı kaydı GERÇEKTEN çözen sayfaya yollar.
  await expect(page.getByTestId('decode-field-table')).toContainText(
    'marine-navigation/nmea-family/nmea-0183',
  );
  await expect(page.getByTestId('decode-field-table')).toContainText('4800 bit/s');

  // -3 NMEA 2000'e yönlendirir.
  await page.locator('#decode-option-transportProfile').selectOption('61162-3');
  await expect(page.getByTestId('decode-field-table')).toContainText(
    'marine-navigation/nmea-family/nmea-2000',
  );

  // Varsayılana dönünce çözüm geri gelir.
  await page.locator('#decode-option-transportProfile').selectOption('450-udpbc');
  await expect(fieldRow(page, 'magic-token')).toHaveCount(1);
});

test('`transmissionGroup` seçilmezse grup basılmaz, seçilince KOŞULSUZ uyarı basar', async ({
  page,
}) => {
  await openDecodePanel(page);

  // Varsayılan: grup alanı HİÇ YOK, yalnız nerede olduğu söyleniyor.
  await expect(fieldRow(page, 'transmission-group')).toHaveCount(0);
  await expect(
    frameWarning(page, tr['protocol.iec61162.warning.transmissionGroupUnknown']),
  ).toHaveCount(1);

  await page.locator('#decode-option-transmissionGroup').selectOption('SATD');
  await expect(fieldRow(page, 'transmission-group').getByTestId('decode-field-raw')).toContainText(
    'SATD',
  );
  await expect(
    fieldRow(page, 'transmission-group').getByTestId('decode-field-physical'),
  ).toHaveText('239.192.0.3:60003');
  await expect(fieldWarning(page, 'transmission-group')).toHaveText(
    tr['protocol.iec61162.field.groupFromUserNotWire'],
  );
  await expect(
    frameWarning(page, tr['protocol.iec61162.warning.groupFromUserNotWire']),
  ).toHaveCount(1);

  // Yanlış grup seçilirse telin talker'larıyla çelişki UYARILIR.
  await page.locator('#decode-option-transmissionGroup').selectOption('TIME');
  await expect(
    frameWarning(page, tr['protocol.iec61162.warning.groupTalkerMismatch']),
  ).toHaveCount(1);
});

test('kapsam dışı `RrUdP` teli sessizce "geçersiz önek" demez, AÇIKÇA kapsam dışı der', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'binary-transfer-out-of-scope');

  await expect(page.getByTestId('decode-parse-error')).toBeVisible();
  await expect(page.getByTestId('decode-parse-error-message')).toContainText('KAPSAM DIŞI');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
