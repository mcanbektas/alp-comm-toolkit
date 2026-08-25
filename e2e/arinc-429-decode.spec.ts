import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 15f'nin gerçek tarayıcı turu — ARINC 429.
 *
 * Kanıtladığı şeyler: sayfa Hazır rozetiyle açılıyor ve `live` sekmesi YOK;
 * `wordByteOrder` seçilmeden yalnız ham word + parite basılıyor;
 * `labelBitOrder` seçilmeden oktal Label BASILMIYOR ve iki şık FARKLI oktal
 * üretiyor; `dataEncoding` değişince SSM alanının adı ve Data'nın yorumu
 * DEĞİŞİYOR; Label'e semantik ad basılmıyor.
 *
 * ── 15e'nin dersi burada AYRICA sınanıyor ──────────────────────────────────
 * 15e'de bir `decodeOptions` seçeneğinin `max` sınırı, gerçekçi bir değer
 * girilince `DecodePanel`in doğrulamasından geçemiyordu; birim test `parse()`i
 * doğrudan çağırdığı için yeşildi, hata YALNIZ tarayıcıda görünüyordu. Bu
 * dosyada üç sayısal seçenek de GERÇEKÇİ değerlerle tarayıcıda deneniyor:
 *   • `resolution` = 0.1 (ONDALIK — `NumberField` `step` vermediği için
 *     tarayıcı bu değeri "step mismatch" sayar; yine de `value` olarak geri
 *     gelmesi ve `Number()` ile 0.1'e çözülmesi gerekir),
 *   • `dataLowBit` = 11, `dataHighBit` = 14 (ARINC'in gerçek bit aralığı,
 *     her ikisinin de `max` sınırının İÇİNDE kalması gerekir).
 */

const tr = translations.tr;

const ARINC_DECODE_PATH = '/comm/aerospace-uav/avionics-data-buses/arinc-429?tab=decode';

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

/**
 * Tuzak (12d/12e): alan uyarısı AYRI bir `<tr>`de basılır — satırın içinden
 * aranırsa BOŞ döner, kökten `data-field-id` ile aranmalı.
 *
 * **15f'te BULUNAN İKİNCİ TUZAK:** brifin listesi strict-mode ihlalini yalnız
 * ÇERÇEVE uyarıları için anıyordu, ama ALAN uyarıları da aynı sorunu yaşıyor —
 * bir alanın birden çok uyarısı varsa (burada Label'in hem "bit sırası
 * seçilmedi" hem "anlamı ICD'ye bağlı" uyarısı var) `data-field-id` seçicisi
 * BİRDEN ÇOK `<li>`ye çözülür ve strict-mode ihlali verir. Metin süzgeci şart.
 */
function fieldWarning(page: Page, fieldId: string, text?: string): Locator {
  const all = page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
  return text === undefined ? all : all.filter({ hasText: text });
}

function frameWarning(page: Page, text: string): Locator {
  // Tuzak: birden çok çerçeve uyarısı aynı anda basılır — `.filter({hasText})` şart.
  return page.locator('[data-testid="decode-frame-warning"]').filter({ hasText: text });
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.getByLabel(tr['decode.example.label']).selectOption(exampleId);
}

async function setOption(page: Page, labelKey: keyof typeof tr, value: string): Promise<void> {
  await page.getByLabel(tr[labelKey]).selectOption(value);
}

test.describe('ARINC 429', () => {
  test('decode sekmesi Hazır rozetiyle açılır, `live` sekmesi YOK, konsola hata basmaz', async ({
    page,
  }) => {
    const consoleErrors = await openDecodePanel(page, ARINC_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ARINC 429');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'arinc-429');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
    // Katalog `live`i BİLEREK dışarıda bıraktı (analog waveform yakalama yok).
    await expect(page.getByRole('tab', { name: tr['tab.live'] })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: tr['tab.decode'] })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('wordByteOrder SEÇİLMEDEN yalnız ham word + parite basılır, uyarı görünür', async ({
    page,
  }) => {
    await openDecodePanel(page, ARINC_DECODE_PATH);
    await selectExample(page, 'label-213-bnr-worked-example');

    await expect(fieldRow(page, 'arinc429-word-0-raw')).toBeVisible();
    // Parite BAYT SIRASINDAN BAĞIMSIZ olduğu için burada bile doğrulanıyor.
    await expect(fieldRow(page, 'arinc429-word-0-parity').getByTestId('decode-field-physical')).toHaveText(
      'PASS',
    );
    await expect(fieldRow(page, 'arinc429-word-0-label')).toHaveCount(0);
    await expect(fieldRow(page, 'arinc429-word-0-data')).toHaveCount(0);
    await expect(
      frameWarning(page, tr['protocol.arinc429.warning.wordByteOrderNotSelected']),
    ).toBeVisible();
  });

  test('labelBitOrder SEÇİLMEDEN oktal Label BASILMAZ, alanlar yine de ayrılır', async ({ page }) => {
    await openDecodePanel(page, ARINC_DECODE_PATH);
    await selectExample(page, 'label-213-bnr-worked-example');
    await setOption(page, 'protocol.arinc429.option.wordByteOrder', 'little-endian');

    await expect(fieldRow(page, 'arinc429-word-0-label')).toBeVisible();
    // `decode-field-raw` sayıyı `0xD1 (209)` biçiminde basar (tuzak listesi).
    await expect(fieldRow(page, 'arinc429-word-0-label').getByTestId('decode-field-raw')).toContainText(
      '209',
    );
    // `physicalValue` VERİLMEDİĞİNDE panel em-dash basar (`DecodePanel` ortak
    // biçimi) — boş dize değil; oktal gösterim gerçekten ÜRETİLMEDİ.
    await expect(
      fieldRow(page, 'arinc429-word-0-label').getByTestId('decode-field-physical'),
    ).toHaveText('—');
    await expect(
      fieldWarning(page, 'arinc429-word-0-label', tr['protocol.arinc429.field.labelBitOrderNotSelected']),
    ).toBeVisible();
    await expect(
      frameWarning(page, tr['protocol.arinc429.warning.labelBitOrderNotSelected']),
    ).toBeVisible();
  });

  test('labelBitOrder iki şıkkı FARKLI oktal üretir — sessiz yanlış değer tarayıcıda da görünür', async ({
    page,
  }) => {
    await openDecodePanel(page, ARINC_DECODE_PATH);
    await selectExample(page, 'label-213-bnr-worked-example');
    await setOption(page, 'protocol.arinc429.option.wordByteOrder', 'little-endian');

    // Referansın KENDİ vektörü: oktet 0xD1 → Label 213₈.
    await setOption(page, 'protocol.arinc429.option.labelBitOrder', 'standard');
    await expect(
      fieldRow(page, 'arinc429-word-0-label').getByTestId('decode-field-physical'),
    ).toHaveText('213₈');

    // Adapter donanımda çevirmişse aynı oktet 321₈ okunur — hata YOK, değer FARKLI.
    await setOption(page, 'protocol.arinc429.option.labelBitOrder', 'pre-reversed');
    await expect(
      fieldRow(page, 'arinc429-word-0-label').getByTestId('decode-field-physical'),
    ).toHaveText('321₈');
  });

  test('Label’e semantik ad BASILMAZ — yalnız oktal, artı ICD uyarısı', async ({ page }) => {
    await openDecodePanel(page, ARINC_DECODE_PATH);
    await selectExample(page, 'label-213-bnr-worked-example');
    await setOption(page, 'protocol.arinc429.option.wordByteOrder', 'little-endian');
    await setOption(page, 'protocol.arinc429.option.labelBitOrder', 'standard');

    const row = fieldRow(page, 'arinc429-word-0-label');
    await expect(row).toContainText('Label (bit 8:1)');
    await expect(row).not.toContainText('Altitude');
    await expect(
      fieldWarning(page, 'arinc429-word-0-label', tr['protocol.arinc429.field.labelMeaningRequiresIcd']),
    ).toBeVisible();
  });

  test('dataEncoding değişince SSM’in ROLÜ ve Data’nın yorumu DEĞİŞİR, iki SSM biti AYNI kalır', async ({
    page,
  }) => {
    await openDecodePanel(page, ARINC_DECODE_PATH);
    await selectExample(page, 'label-213-bnr-worked-example');
    await setOption(page, 'protocol.arinc429.option.wordByteOrder', 'little-endian');

    const ssm = fieldRow(page, 'arinc429-word-0-ssm');

    // (a) Kodlama seçilmeden: nötr ad + "kodlama gerekiyor" uyarısı, yorum alanı YOK.
    await expect(ssm).toContainText('SSM (bit 31:30)');
    await expect(ssm.getByTestId('decode-field-physical')).toHaveText('11');
    await expect(
      fieldWarning(page, 'arinc429-word-0-ssm', tr['protocol.arinc429.field.ssmMeaningRequiresEncoding']),
    ).toBeVisible();
    await expect(fieldRow(page, 'arinc429-word-0-bnr')).toHaveCount(0);

    // (b) BNR: SSM'in adı DEĞİŞİR, BNR alanı BELİRİR, işaret bit 29'a devredilir.
    await setOption(page, 'protocol.arinc429.option.dataEncoding', 'bnr');
    await expect(ssm).toContainText('BNR status');
    await expect(ssm.getByTestId('decode-field-physical')).toHaveText('11');
    await expect(fieldRow(page, 'arinc429-word-0-bnr')).toBeVisible();
    await expect(fieldRow(page, 'arinc429-word-0-bnr-sign').getByTestId('decode-field-physical')).toHaveText(
      'Plus, North, East, Right, To, Above',
    );

    // (c) Discrete: SSM'in adı YİNE değişir, BNR alanı KAYBOLUR.
    await setOption(page, 'protocol.arinc429.option.dataEncoding', 'discrete');
    await expect(ssm).toContainText('discrete signless status');
    await expect(fieldRow(page, 'arinc429-word-0-bnr')).toHaveCount(0);
    await expect(fieldRow(page, 'arinc429-word-0-discrete')).toBeVisible();

    // SAYISAL durum adı hiçbir kipte basılmaz (iki bağımsız kaynak çelişiyor).
    await expect(ssm).not.toContainText('Normal Operation');
    await expect(ssm).not.toContainText('Failure Warning');
  });

  test('resolution 0.1 ONDALIK değeri panelden geçer ve BNR 1234.5 verir (15e’nin dersi)', async ({
    page,
  }) => {
    await openDecodePanel(page, ARINC_DECODE_PATH);
    await selectExample(page, 'label-213-bnr-worked-example');
    await setOption(page, 'protocol.arinc429.option.wordByteOrder', 'little-endian');
    await setOption(page, 'protocol.arinc429.option.dataEncoding', 'bnr');

    const bnr = fieldRow(page, 'arinc429-word-0-bnr');
    // Çözünürlük VERİLMEDEN fiziksel değer ham işaretli sayıdır + uyarı.
    await expect(bnr.getByTestId('decode-field-physical')).toHaveText('12345');
    await expect(
      fieldWarning(page, 'arinc429-word-0-bnr', tr['protocol.arinc429.field.resolutionRequiredForPhysicalValue']),
    ).toBeVisible();

    // Spec çalışılmış örneği: 12345 × 0.1 = 1234.5. `max` sınırı OLMADIĞI için
    // ondalık değer panelin doğrulamasından geçer (15e'de kırılan tam bu yerdi).
    await page.getByLabel(tr['protocol.arinc429.option.resolution']).fill('0.1');
    await expect(bnr.getByTestId('decode-field-physical')).toHaveText('1234.5');
    await expect(fieldWarning(page, 'arinc429-word-0-bnr')).toHaveCount(0);
  });

  test('dataLowBit/dataHighBit gerçekçi ARINC değerleriyle (11/14) panelden geçer', async ({
    page,
  }) => {
    await openDecodePanel(page, ARINC_DECODE_PATH);
    await selectExample(page, 'label-213-bnr-worked-example');
    await setOption(page, 'protocol.arinc429.option.wordByteOrder', 'little-endian');
    await setOption(page, 'protocol.arinc429.option.dataEncoding', 'bnr');

    await page.getByLabel(tr['protocol.arinc429.option.dataLowBit']).fill('11');
    await page.getByLabel(tr['protocol.arinc429.option.dataHighBit']).fill('14');

    // Alan adı seçilen aralığı taşır — değer panelde SESSİZCE 0'a düşmedi.
    await expect(fieldRow(page, 'arinc429-word-0-bnr')).toContainText('bit 14:11');
    await expect(
      frameWarning(page, tr['protocol.arinc429.warning.dataBitRangeInvalid']),
    ).toHaveCount(0);
  });

  test('BCD örneği beş basamağa çözülür, geçersiz basamak yok', async ({ page }) => {
    await openDecodePanel(page, ARINC_DECODE_PATH);
    await selectExample(page, 'label-107-bcd-five-digits');
    await setOption(page, 'protocol.arinc429.option.wordByteOrder', 'little-endian');
    await setOption(page, 'protocol.arinc429.option.labelBitOrder', 'standard');
    await setOption(page, 'protocol.arinc429.option.dataEncoding', 'bcd');

    await expect(
      fieldRow(page, 'arinc429-word-0-label').getByTestId('decode-field-physical'),
    ).toHaveText('107₈');
    await expect(fieldRow(page, 'arinc429-word-0-bcd').getByTestId('decode-field-physical')).toHaveText(
      '12345',
    );
  });

  test('parite hatası örneği parse hatası DEĞİL, çerçeve hatası basar', async ({ page }) => {
    await openDecodePanel(page, ARINC_DECODE_PATH);
    await selectExample(page, 'parity-error');
    await setOption(page, 'protocol.arinc429.option.wordByteOrder', 'little-endian');

    // Tuzak: `success:false` `decode-parse-error` basardı — burada çözüm
    // BAŞARILI, yalnız çerçeve geçersiz, o yüzden `decode-frame-error` çıkar.
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error').first()).toBeVisible();
    await expect(fieldRow(page, 'arinc429-word-0-parity').getByTestId('decode-field-physical')).toHaveText(
      'FAIL',
    );
  });

  test('word hizasız örnek `decode-parse-error` kartı basar', async ({ page }) => {
    await openDecodePanel(page, ARINC_DECODE_PATH);
    await selectExample(page, 'not-word-aligned');

    await expect(page.getByTestId('decode-parse-error')).toBeVisible();
    await expect(page.getByTestId('decode-parse-error-message')).toContainText(
      tr['protocol.arinc429.error.notWordAligned'],
    );
  });

  test('iki word’lük yakalamada alanlar word indeksiyle ayrışır', async ({ page }) => {
    await openDecodePanel(page, ARINC_DECODE_PATH);
    await selectExample(page, 'two-word-capture');
    await setOption(page, 'protocol.arinc429.option.wordByteOrder', 'little-endian');
    await setOption(page, 'protocol.arinc429.option.labelBitOrder', 'standard');

    await expect(
      fieldRow(page, 'arinc429-word-0-label').getByTestId('decode-field-physical'),
    ).toHaveText('213₈');
    await expect(
      fieldRow(page, 'arinc429-word-1-label').getByTestId('decode-field-physical'),
    ).toHaveText('107₈');
  });

  test('definitions sekmesi AÇILIR ama BOŞ kalır — ICD veritabanı kapsam dışı', async ({ page }) => {
    // Katalog `definitions: ['vendor-map','custom-schema']` bildiriyor, ama
    // hiçbir tanım paneli BAĞLI DEĞİL (`snmp.ts`/`bleGatt.ts`/14'ün a2l-ldf
    // emsali). Bunu VARSAYMAK yetmez — sekme gerçekten açılıp çökmediği ve
    // "planlandı" bildirimi basmadığı tarayıcıda görülmeli
    // ([[ekrani-gercekten-ac]]).
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto('/comm/aerospace-uav/avionics-data-buses/arinc-429?tab=definitions');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ARINC 429');
    await expect(page.getByRole('tab', { name: tr['tab.definitions'] })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // Bağlı bir tanım paneli YOK — DBC/EDS panellerinin hiçbiri açılmamalı.
    await expect(page.getByTestId('dbc-panel')).toHaveCount(0);
    await expect(page.getByTestId('eds-panel')).toHaveCount(0);
    // Panel bağlı olmadığı için sayfa BOŞ KART basmaz, "neyin geleceğini
    // söyleyen" bildirimi basar — kaydın kendisi `ready` olsa bile. `lin`in
    // `definitions` sekmesi aynı davranışı gösteriyor ve
    // `eds-definitions.spec.ts:145` bunu zaten bekçiliyor; ARINC 429 o
    // emsalin üstüne yeni bir dal AÇMIYOR.
    await expect(page.getByText(tr['protocol.plannedNotice'])).toBeVisible();
    // Ama `decode` sekmesi GERÇEK motorunu gösteriyor — bildirim orada YOK.
    await page.goto('/comm/aerospace-uav/avionics-data-buses/arinc-429?tab=decode');
    await expect(page.getByTestId('decode-panel')).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
    expect(consoleErrors, `sayfa hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('big-endian örneği DOĞRU sırayla 213₈, YANLIŞ sırayla başka bir değer verir', async ({
    page,
  }) => {
    await openDecodePanel(page, ARINC_DECODE_PATH);
    await selectExample(page, 'big-endian-adapter-word');
    await setOption(page, 'protocol.arinc429.option.labelBitOrder', 'standard');

    await setOption(page, 'protocol.arinc429.option.wordByteOrder', 'big-endian');
    const label = fieldRow(page, 'arinc429-word-0-label').getByTestId('decode-field-physical');
    await expect(label).toHaveText('213₈');

    await setOption(page, 'protocol.arinc429.option.wordByteOrder', 'little-endian');
    await expect(label).not.toHaveText('213₈');
  });
});
