import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 17'nin gerçek tarayıcı turu — LonWorks
 * (`building-automation` domain'ini KAPATAN kayıt).
 *
 * Motor birim testlerde alan alan doğrulandı; bu dosya motoru değil,
 * **kapsam kararının ve iki sessiz-yanlış noktasının EKRANDA görünür
 * olduğunu** sınar:
 *   · rozet "Kısmi" ve özet neyin ÇÖZÜLMEDİĞİNİ açıkça yazıyor mu,
 *   · 1) ve 2) çerçeveleri AYNI transaction numarasını gösteriyor mu,
 *   · 4)'te NM/ND yanıt kodu belirsizliği uyarısı görünüyor mu,
 *   · 7) GERÇEK yakalamadan gelen kesik çerçeve hatasını basıyor mu,
 *   · kapsam dışı protokol kodu AÇIKÇA reddediliyor mu,
 *   · HER NV çözümünde "tip telde yok" uyarısı görünüyor mu,
 *   · `nvPayloadType` SNVT_temp_p seçilince 2.02 °C, SNVT_temp seçilince
 *     −253.8 °C okunuyor mu (ölçek formülünün EKRANDAKİ kanıtı),
 *   · `definitions` sekmesi "planlandı" basıyor mu (XIF paneli YAZILMADI).
 * Desen `iec-61162-decode.spec.ts` (16c) ve `seatalk-decode.spec.ts`ten.
 */

const tr = translations.tr;
const DECODE_PATH = '/comm/building-automation/lonworks/lonworks?tab=decode';
const DEFINITIONS_PATH = '/comm/building-automation/lonworks/lonworks?tab=definitions';

/** Wireshark wiki'sinin `eia709.1-over-eia852.pcap` yakalamasının ilk datagramı. */
const DEFAULT_EXAMPLE_HEX =
  '00 20 01 01 00 00 00 00 6B 8B 45 67 00 00 00 00 00 00 00 00 01 09 01 AA 01 A9 01 03 81 0D 00 CA';

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

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors = await openPage(page, DECODE_PATH);
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
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

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** Çeviri anahtarının ham hâlde ekrana düşmesi sessiz bir eksik anahtar demektir. */
async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const text of await page.getByTestId(testId).allTextContents()) {
      expect(text.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test('sayfa Kısmi rozetiyle açılır, özet kapsam dışını AÇIKÇA yazar, konsola hata basmaz', async ({
  page,
}) => {
  const consoleErrors = await openDecodePanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('LonWorks');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'lonworks');
  await expect(page.getByTestId('decode-plugin-name')).toHaveText('LonWorks');
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  // Katalog özeti (protokol VERİSİDİR, çevrilmez) çözüleni, çözülmeyeni ve
  // TELDE HİÇ OLMAYANI AYRI AYRI sayar — `iec-61162-decode.spec.ts` ölçütü.
  const summary = page.locator('p', { hasText: 'NOT ON THE WIRE AT ALL' }).first();
  await expect(summary).toContainText('DECODED');
  await expect(summary).toContainText('OUT OF SCOPE');
  await expect(summary).toContainText('NO public capture path');
  await expect(summary).toContainText('XIF');

  await expect(page.locator('#decode-hex')).toHaveValue(DEFAULT_EXAMPLE_HEX);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('1) ve 2) çerçeveleri AYNI transaction numarasını taşır — eşleşme ekranda', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(fieldRow(page, 'cnip-packet-size').getByTestId('decode-field-physical')).toHaveText(
    '32 B (header included)',
  );
  await expect(fieldRow(page, 'lontalk-tsa-type').getByTestId('decode-field-physical')).toHaveText(
    'ACKD',
  );
  await expect(
    fieldRow(page, 'lontalk-transaction').getByTestId('decode-field-physical'),
  ).toHaveText('3');
  await expect(fieldRow(page, 'lontalk-dst-node').getByTestId('decode-field-physical')).toHaveText(
    '41',
  );

  await selectExample(page, 'tpdu-ack');
  await expect(fieldRow(page, 'lontalk-tsa-type').getByTestId('decode-field-physical')).toHaveText(
    'ACK',
  );
  // AYNI transaction, TERS yön.
  await expect(
    fieldRow(page, 'lontalk-transaction').getByTestId('decode-field-physical'),
  ).toHaveText('3');
  await expect(fieldRow(page, 'lontalk-dst-node').getByTestId('decode-field-physical')).toHaveText(
    '42',
  );
});

test('SPDU RESPONSE`ta yanıt kodu belirsizliği İKİ ADAYI birden gösterir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'spdu-response-ambiguous');

  // Alan adı "Application Code" KALIR — uydurma bir "NM yanıtı" adı basılmaz.
  await expect(fieldRow(page, 'lontalk-apdu-class').getByTestId('decode-field-physical')).toHaveText(
    'Application (generic)',
  );
  const code = fieldRow(page, 'lontalk-app-code').getByTestId('decode-field-physical');
  await expect(code).toContainText('NM_NV_FETCH');
  await expect(code).toContainText('ND_CLEAR_STATUS');

  await expect(fieldWarning(page, 'lontalk-app-code')).toHaveText(
    tr['protocol.lonworks.field.responseCodeAmbiguous'],
  );
  await expect(
    frameWarning(page, tr['protocol.lonworks.warning.responseCodeAmbiguous']),
  ).toHaveCount(1);
});

test('7) GERÇEK yakalamadan gelen kesik çerçeve hatasını basar ve KISMİ çözüm kalır', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'broadcast-truncated');

  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
    'data-error-code',
    'truncated-frame',
  );
  // Kısmi çözüm gösterilir: öncelik biti, broadcast adresi ve sıfır domain.
  await expect(fieldRow(page, 'lontalk-priority').getByTestId('decode-field-physical')).toHaveText(
    'priority slot',
  );
  await expect(
    fieldRow(page, 'lontalk-address-format').getByTestId('decode-field-physical'),
  ).toHaveText('Broadcast');
  await expect(fieldRow(page, 'lontalk-domain').getByTestId('decode-field-physical')).toContainText(
    'zero-length domain',
  );
  // Taşıma okteti HİÇ okunmadı.
  await expect(fieldRow(page, 'lontalk-transaction')).toHaveCount(0);
});

test('kapsam dışı protokol kodu TANINIR ve AÇIKÇA reddedilir — sessizce "geçersiz" DENMEZ', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'foreign-protocol-code');

  const error = page.getByTestId('decode-frame-error');
  await expect(error).toHaveAttribute('data-error-code', 'unsupported-encoding');
  await expect(error).toContainText(tr['protocol.lonworks.error.protocolCodeOutOfScope']);
  // Zarfın okunabilen alanları YİNE basılır (boş kart yasağı).
  await expect(fieldRow(page, 'cnip-session-id').getByTestId('decode-field-physical')).toHaveText(
    '0x6B8B4567',
  );
  await expect(
    fieldRow(page, 'cnip-protocol-flags').getByTestId('decode-field-physical'),
  ).toContainText('not EIA-709');

  // Data Packet olmayan tip ise HATA DEĞİLDİR: ad basılır, gövde ham kalır.
  await selectExample(page, 'non-data-packet');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expect(fieldRow(page, 'cnip-packet-type').getByTestId('decode-field-physical')).toHaveText(
    'Device Configuration Request',
  );
  await expect(fieldRow(page, 'cnip-body')).toHaveCount(1);
});

test('HER NV çözümünde "tip telde yok" uyarısı görünür ve KAPATILAMAZ', async ({ page }) => {
  await openDecodePanel(page);

  await expect(fieldWarning(page, 'lontalk-nv-selector')).toHaveText(
    tr['protocol.lonworks.field.nvTypeNotOnWire'],
  );
  await expect(frameWarning(page, tr['protocol.lonworks.warning.nvTypeNotOnWire'])).toHaveCount(1);

  // Tip SEÇİLDİKTEN sonra da uyarı DURUR: seçim bir ölçüm değil, bir bildirimdir.
  await page.locator('#decode-option-nvPayloadType').selectOption('SNVT_temp_p');
  await expect(frameWarning(page, tr['protocol.lonworks.warning.nvTypeNotOnWire'])).toHaveCount(1);
  await expect(fieldWarning(page, 'lontalk-nv-scaled')).toHaveText(
    tr['protocol.lonworks.field.nvTypeNotOnWire'],
  );

  // NV taşımayan çerçevede uyarı YOKTUR.
  await selectExample(page, 'tpdu-ack');
  await expect(frameWarning(page, tr['protocol.lonworks.warning.nvTypeNotOnWire'])).toHaveCount(0);
});

test('AYNI iki bayt seçilen SNVT tipine göre 2.02 °C ya da −253.8 °C okunur', async ({ page }) => {
  await openDecodePanel(page);

  // Tip seçilmeden ölçekli alan HİÇ YOK — değer HAM kalır.
  await expect(fieldRow(page, 'lontalk-nv-scaled')).toHaveCount(0);
  await expect(fieldRow(page, 'lontalk-nv-payload').getByTestId('decode-field-raw')).toHaveText(
    '00 CA',
  );

  await page.locator('#decode-option-nvPayloadType').selectOption('SNVT_temp_p');
  await expect(fieldRow(page, 'lontalk-nv-scaled').getByTestId('decode-field-physical')).toHaveText(
    '2.02 °C',
  );

  // AYNI baytlar, BAŞKA tip: ölçek formülünün `(ham + C)` parantezi burada
  // görünür — `(A × 10^B) × ham + C` yazılsaydı −2719.8 °C basılırdı.
  await page.locator('#decode-option-nvPayloadType').selectOption('SNVT_temp');
  await expect(fieldRow(page, 'lontalk-nv-scaled').getByTestId('decode-field-physical')).toHaveText(
    '-253.8 °C',
  );

  await page.locator('#decode-option-nvPayloadType').selectOption('SNVT_lev_percent');
  await expect(fieldRow(page, 'lontalk-nv-scaled').getByTestId('decode-field-physical')).toHaveText(
    '1.01 %',
  );

  // Boyutsuz tipte birim ATANMAZ.
  await page.locator('#decode-option-nvPayloadType').selectOption('SNVT_count');
  await expect(fieldRow(page, 'lontalk-nv-scaled').getByTestId('decode-field-physical')).toHaveText(
    '202',
  );
});

test('ham PDU + kuyruk CRC şıkkı seçilince CRC-16/GENIBUS GERÇEKTEN doğrulanır', async ({
  page,
}) => {
  await openDecodePanel(page);

  // Varsayılan tünel modunda CRC alanı YOKTUR ve motor bunu söyler.
  await expect(fieldRow(page, 'lontalk-crc')).toHaveCount(0);
  await expect(frameWarning(page, tr['protocol.lonworks.warning.tunnelCarriesNoCrc'])).toHaveCount(1);

  await selectExample(page, 'raw-pdu-with-crc');
  // Zarfsız PDU tünel modunda HİÇ ÇÖZÜLEMEZ: çerçeve düzeyinde değil, PARSE
  // düzeyinde başarısız olur (yirmi baytlık CN/IP başlığı yok).
  await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
    'data-error-code',
    'truncated-frame',
  );

  await page.locator('#decode-option-payloadKind').selectOption('raw-lontalk-pdu-with-crc');
  await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expect(fieldRow(page, 'lontalk-crc').getByTestId('decode-field-physical')).toHaveText(
    'PASS (covers 12 B)',
  );
  await expect(fieldRow(page, 'lontalk-crc')).toHaveAttribute('data-valid', 'true');
});

test('`definitions` sekmesi "planlandı" basar — XIF paneli bu dalgada YAZILMADI', async ({
  page,
}) => {
  const consoleErrors = await openPage(page, DEFINITIONS_PATH);

  await expect(page.getByTestId('eds-panel')).toHaveCount(0);
  await expect(page.getByTestId('dbc-panel')).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toBeVisible();
  // Sayfanın KENDİ rozeti yine "Kısmi"dir: sekme planlı, kayıt değil.
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('uyarı ve hata metinleri ÇEVRİLMİŞ basılır — ham anahtar sızmaz', async ({ page }) => {
  await openDecodePanel(page);
  await expectNoRawTranslationKeys(page);

  // Uyarı yüzeyinin en geniş olduğu iki çerçevede de sınanır.
  await selectExample(page, 'spdu-response-ambiguous');
  await expectNoRawTranslationKeys(page);
  await selectExample(page, 'foreign-frame');
  await expectNoRawTranslationKeys(page);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
