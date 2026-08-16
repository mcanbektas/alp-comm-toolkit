import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 5e'nin gerçek tarayıcı turu — IEC 61850 GOOSE.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/scada-utility/
 * iec-61850) KISMİ rozetiyle açıldığı — karar 4'ün "motor GOOSE-only, MMS ve
 * SCL yok" kararı ekranda görünüyor (MAVLink'in partial rozeti emsali);
 * Ethernet başlığının GOOSE sayfasında da alan olarak çözüldüğü (karar 5);
 * BER'le kodlanmış her PDU alanının ve dataset elemanının ekranda çıktığı;
 * VLAN tag'inin bütün ofsetleri kaydırdığı; zaman damgasının saniye/kesir/
 * kalite diye üçe bölündüğü; numDatSetEntries uyuşmazlığı (uyarı), bozuk BER
 * uzunluğu (hata), yanlış EtherType (hata) ve kesik çerçeve (ParseFailure)
 * yollarının gerçekten göründüğü.
 *
 * GOOSE'un alias sayfası YOK (katalog "Katalog yolları" tablosu) — alias
 * devralma testi burada yok.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/industrial-automation/scada-utility/iec-61850?tab=decode';

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

/** Bu motor bir çerçevede birden çok frame-uyarısı basar — tek tek aranır,
 * `toContainText` strict-mode'a takılır (EtherCAT turunun aynı gerekçesi). */
function frameWarning(page: Page, text: string): Locator {
  return page.getByTestId('decode-frame-warning').filter({ hasText: text });
}

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test.describe('IEC 61850 GOOSE', () => {
  test('decode sekmesi Kısmi rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IEC 61850');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'iec-61850');
    // Karar 4: kaydın vaat ettiği MMS/SCL yok → 'ready' değil 'partial'.
    await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('kararlı durum örneği Ethernet başlığını, GOOSE başlığını ve PDU alanlarını basar', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('steady-state-publication');

    await expect(
      fieldRow(page, 'destination-mac').getByTestId('decode-field-physical'),
    ).toContainText('IEC/TC57 GOOSE range');
    await expect(fieldRow(page, 'ethertype').getByTestId('decode-field-physical')).toHaveText(
      'GOOSE',
    );
    // Birim ('B') gösterimde eklenir; Length'in Ethernet başlığını saymadığı
    // burada ekranda görünür (169 = 8 + 161, çerçeve 183 bayt).
    await expect(fieldRow(page, 'goose-length').getByTestId('decode-field-physical')).toHaveText(
      'header 8 + APDU 161 B',
    );
    await expect(fieldRow(page, 'goose-pdu').getByTestId('decode-field-physical')).toHaveText(
      'APPLICATION 1 (goosePdu)',
    );
    await expect(fieldRow(page, 'gocb-ref').getByTestId('decode-field-raw')).toContainText(
      'gcbProtectionEvents',
    );
    await expect(fieldRow(page, 'st-num').getByTestId('decode-field-raw')).toContainText('1');
    await expect(fieldRow(page, 'sq-num').getByTestId('decode-field-raw')).toContainText('12');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('zaman damgası saniye / kesir / kalite olarak üçe bölünür', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('steady-state-publication');

    await expect(fieldRow(page, 'timestamp').getByTestId('decode-field-physical')).toHaveText(
      '2026-02-16T12:00:00.500Z',
    );
    await expect(
      fieldRow(page, 'timestamp-fraction').getByTestId('decode-field-physical'),
    ).toHaveText('500 ms');
    await expect(fieldRow(page, 'timestamp-quality').getByTestId('decode-field-physical')).toContainText(
      'leapSecondsKnown=1',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('dataset elemanları tipiyle adlandırılır, anlamları için SCL notu basılır', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('steady-state-publication');

    await expect(fieldRow(page, 'data-0').getByTestId('decode-field-physical')).toHaveText('FALSE');
    await expect(fieldRow(page, 'data-1').getByTestId('decode-field-physical')).toHaveText(
      '13 bits (unused 3)',
    );
    await expect(fieldRow(page, 'data-2').getByTestId('decode-field-raw')).toContainText('42');
    await expect(fieldRow(page, 'data-4')).toHaveCount(0);
    await expect(
      frameWarning(page, tr['protocol.goose.warning.dataSemanticsNeedScl']),
    ).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('VLAN tag’li örnek tag alanlarını basar ve ofsetleri kaydırır', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('vlan-tagged-publication');

    await expect(fieldRow(page, 'vlan-1-vid')).toHaveCount(1);
    await expect(fieldRow(page, 'appid')).toHaveCount(1);
    await expect(fieldRow(page, 'gocb-ref')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('durum değişikliği örneğinde stNum artar, sqNum sıfırlanır', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('state-change-publication');

    await expect(fieldRow(page, 'st-num').getByTestId('decode-field-raw')).toContainText('2');
    await expect(fieldRow(page, 'sq-num').getByTestId('decode-field-raw')).toContainText('0');
    await expect(fieldRow(page, 'data-0').getByTestId('decode-field-physical')).toHaveText('TRUE');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('iç içe structure örneği alt elemanlara iner ve float’ı çözer', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('structured-dataset');

    await expect(fieldRow(page, 'data-0-0').getByTestId('decode-field-physical')).toHaveText(
      '230.5',
    );
    await expect(fieldRow(page, 'data-1-quality')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('simülasyon örneği Reserved 1’i adlandırmaz, ham gösterir ve uyarır', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('simulated-publication');

    await expect(fieldRow(page, 'reserved1').getByTestId('decode-field-physical')).toHaveText(
      '0x8000',
    );
    await expect(fieldRow(page, 'reserved1-simulated')).toHaveCount(0);
    await expect(frameWarning(page, tr['protocol.goose.warning.reservedNotZero'])).toHaveCount(1);
    await expect(fieldRow(page, 'simulation').getByTestId('decode-field-physical')).toHaveText(
      'TRUE',
    );
    await expect(frameWarning(page, tr['protocol.goose.warning.simulationActive'])).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('numDatSetEntries uyuşmazlığı uyarı basar, hata basmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('dataset-count-mismatch');

    await expect(
      frameWarning(page, tr['protocol.goose.warning.dataSetCountMismatch']),
    ).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('bozuk BER uzunluğu örneği hata kartı basar ama çözülen alanları korur', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('indefinite-length-ber');

    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'unsupported-encoding',
    );
    await expect(page.getByTestId('decode-frame-error')).toContainText(
      tr['protocol.goose.error.berIndefiniteLength'],
    );
    await expect(fieldRow(page, 'st-num')).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('yanlış EtherType örneği hata kartı basar ve gövdeye dokunmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('ethertype-not-goose');

    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'start-delimiter-not-found',
    );
    await expect(fieldRow(page, 'appid')).toHaveCount(0);
    await expect(fieldRow(page, 'payload')).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('çok kısa çerçeve örneği parse hatası kartı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('frame-too-short');

    const parseError = page.getByTestId('decode-parse-error');
    await expect(parseError).toBeVisible();
    await expect(parseError).toHaveAttribute('data-error-code', 'truncated-frame');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IEC 61850');
    await expect(page.getByText(translations.en['status.partial'], { exact: true })).toBeVisible();
    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('indefinite-length-ber');
    await expect(page.getByTestId('decode-frame-error')).toContainText(
      translations.en['protocol.goose.error.berIndefiniteLength'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('ethernet-ii sayfası 0x88B8’i adlandırır ama çözmez', async ({ page }) => {
    // Karar 5'in ikinci yarısı: zincir KURULMAZ, yalnız yönlendirilir.
    await openDecodePanel(page, '/comm/network-ethernet/data-link/ethernet-ii?tab=decode');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ethernet-ii');
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('structured-dataset');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
