import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 6c'nin gerçek tarayıcı turu — sACN (ANSI E1.31).
 *
 * Kanıtladığı şeyler: kanonik sayfanın (building-automation/lighting-networks/
 * sacn) Hazır rozetiyle açıldığı — kamu-kaynaklı üçlünün (6a-6c) SONUNCUSU;
 * mutlu yolda Root/Framing/DMP alanlarının hepsinin (ACN Packet Identifier,
 * Root Vector, CID, Source Name, Priority, Universe, start-code+slotlar)
 * göründüğü; dmx512.ts ile AYNI slot özet deseninin (ilk 16 ayrı satır, kalanı
 * tek özet blok) DMP Property Values'ta da çalıştığı; Priority'nin sınır
 * değerlerinde (0/200) uyarı basmadığı; Options Stream_Terminated bitinin
 * doğru okunduğu; Universe aralık dışı değerin (Discovery'ye rezerve 64214)
 * hata değil uyarı bastığı; bozuk ACN Packet Identifier'ın hata yolunu
 * izlediği ve Root Vector'ün hiç okunmadığı; katman-length tutarsızlığının
 * hata değil uyarı bastığı; Root Vector EXTENDED'de gövdenin ham blok kalıp
 * Framing/DMP alanlarının HİÇ basılmadığı.
 *
 * sACN'in alias sayfası YOK (katalog "Katalog yolları" tablosu) — alias
 * devralma testi burada yok. BEKÇİ BORCU yok (brief), ekstra iş gerekmedi.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/building-automation/lighting-networks/sacn?tab=decode';

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

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test.describe('sACN', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('sACN');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'sacn');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('mutlu yol: Root/Framing/DMP alanları ve spec’in kendi RGB fixture değerleri basılır', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('data-packet-happy-path');

    await expect(fieldRow(page, 'acn-packet-identifier')).toHaveAttribute('data-valid', 'true');
    await expect(fieldRow(page, 'root-vector').getByTestId('decode-field-physical')).toHaveText(
      'VECTOR_ROOT_E131_DATA',
    );
    await expect(fieldRow(page, 'source-name').getByTestId('decode-field-raw')).toHaveText('Lighting Console 1');
    await expect(fieldRow(page, 'universe').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'start-code').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
    await expect(fieldRow(page, 'slot-1').getByTestId('decode-field-raw')).toHaveText('0xFF (255)');
    await expect(fieldRow(page, 'slot-2').getByTestId('decode-field-raw')).toHaveText('0x80 (128)');
    await expect(fieldRow(page, 'slot-3').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
    await expect(fieldRow(page, 'slot-4').getByTestId('decode-field-raw')).toHaveText('0xC8 (200)');
    await expect(fieldRow(page, 'slot-data')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tam 512 slotlu universe’da yalnız ilk 16 slot ayrı satırdır, kalanı özet alanda toplanır (dmx512.ts deseni)', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('data-packet-full-512-universe');

    await expect(fieldRow(page, 'slot-1')).toHaveCount(1);
    await expect(fieldRow(page, 'slot-16')).toHaveCount(1);
    await expect(fieldRow(page, 'slot-17')).toHaveCount(0);
    await expect(fieldRow(page, 'slot-512')).toHaveCount(0);
    await expect(fieldRow(page, 'slot-data').getByTestId('decode-field-select')).toHaveText('Slots 17-512');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Priority sınır değerleri (0 ve 200) uyarı basmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('priority-boundary-zero');
    await expect(fieldRow(page, 'priority')).toHaveAttribute('data-valid', 'true');
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);

    await page.getByLabel(tr['decode.example.label']).selectOption('priority-boundary-two-hundred');
    await expect(fieldRow(page, 'priority')).toHaveAttribute('data-valid', 'true');
    await expect(fieldRow(page, 'priority').getByTestId('decode-field-raw')).toHaveText('0xC8 (200)');
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Options: Stream_Terminated biti set olunca yalnız o bit 1 okunur', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('options-stream-terminated');

    await expect(fieldRow(page, 'preview-data').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
    await expect(fieldRow(page, 'stream-terminated').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'stream-terminated').getByTestId('decode-field-physical')).toHaveText('Set');
    await expect(fieldRow(page, 'force-synchronization').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Universe aralık dışı (64214, Discovery’ye rezerve) hata değil uyarı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('universe-out-of-range');

    const universe = fieldRow(page, 'universe');
    await expect(universe).toHaveAttribute('data-valid', 'false');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.sacn.warning.universeOutOfRange'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('bozuk ACN Packet Identifier hata yolunu izler, Root Vector hiç okunmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('invalid-acn-packet-identifier');

    await expect(fieldRow(page, 'acn-packet-identifier')).toHaveAttribute('data-valid', 'false');
    await expect(fieldRow(page, 'root-vector')).toHaveCount(0); // imza doğrulanmadan sonrası hiç okunmaz
    await expect(page.getByTestId('decode-frame-error')).toContainText(
      tr['protocol.sacn.error.invalidAcnPacketIdentifier'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('katman-length tutarsızlığı hata değil uyarı basar, alanlar gerçek bayttan çözülür', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('layer-length-mismatch');

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.sacn.warning.layerLengthMismatch'],
    );
    // Property Value Count beyanı fazla ama gerçekte yalnız 4 slot var — slot-5 YOK.
    await expect(fieldRow(page, 'slot-4')).toHaveCount(1);
    await expect(fieldRow(page, 'slot-5')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Root Vector EXTENDED: gövde ham blok kalır, Framing/DMP alanları hiç basılmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('root-vector-extended-not-decoded');

    await expect(fieldRow(page, 'root-vector').getByTestId('decode-field-physical')).toHaveText(
      'VECTOR_ROOT_E131_EXTENDED',
    );
    await expect(fieldRow(page, 'source-name')).toHaveCount(0);
    await expect(fieldRow(page, 'universe')).toHaveCount(0);
    await expect(fieldRow(page, 'body')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.sacn.warning.rootVectorBodyNotDecoded'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('sACN');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('layer-length-mismatch');
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      translations.en['protocol.sacn.warning.layerLengthMismatch'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('data-packet-full-512-universe');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
