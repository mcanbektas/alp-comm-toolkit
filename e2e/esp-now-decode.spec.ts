import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 18c'nin gerçek tarayıcı turu — ESP-NOW. Motor seviyesi
 * `espNow.test.ts`/`espNowCanParseRegistry.test.ts`te doğrulandı; bu dosya
 * motoru değil, motor↔ekran bağlantısını sınar (desen `wifi-decode.spec.ts`
 * ve `xmodem-decode.spec.ts`ten — bu dosyada paylaşılan bir e2e yardımcı
 * modül YOK, her decode spec kendi yardımcılarını taşır).
 */

const tr = translations.tr;
const DECODE_PATH = '/comm/wireless-iot/wifi-wireless/esp-now?tab=decode';

/**
 * `data-testid`si `decode-*` ÖNEKLİ TÜM alan/uyarı metinlerinin çeviri
 * anahtarı GİBİ görünmemesi gerekir — sızarsa `t()` çağrısı bir yerlerde
 * eksik demektir. Nokta sonrası bölüm bir HARFLE başlamak ZORUNDA: yoksa
 * `"v1.0"`/`"v2.0"` gibi meşru sürüm etiketleri de "anahtar" sanılır — bu
 * sayfanın kendi metninde tam olarak bu iki değer var, ölçüldü.
 */
const RAW_TRANSLATION_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/;

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

function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

function frameWarning(page: Page, text: string): Locator {
  return page.getByTestId('decode-frame-warning').filter({ hasText: text });
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

async function selectOption(page: Page, optionId: string, value: string): Promise<void> {
  await page.locator(`#decode-option-${optionId}`).selectOption(value);
}

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  const testIds = [
    'decode-field-physical',
    'decode-field-raw',
    'decode-frame-warning',
    'decode-field-warning',
    'decode-frame-error',
  ];
  for (const testId of testIds) {
    const texts = await page.getByTestId(testId).allTextContents();
    for (const text of texts) {
      const trimmed = text.trim();
      expect(
        RAW_TRANSLATION_KEY_PATTERN.test(trimmed),
        `ham çeviri anahtarı sızmış olabilir (${testId}): "${trimmed}"`,
      ).toBe(false);
    }
  }
}

test('decode sekmesi Hazır rozetiyle açılır, konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ESP-NOW');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'esp-now');
  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('örnek 1 — yayın, tek element: Category/OUI/sürüm doğru, ASCII şemasında gövde "ALP Comm 18c"', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'broadcast-single-element');
  await selectOption(page, 'payloadSchema', 'ascii');

  await expect(fieldRow(page, 'espnow-category').getByTestId('decode-field-physical')).toHaveText(
    'Vendor Specific (127)',
  );
  await expect(fieldRow(page, 'espnow-oui').getByTestId('decode-field-physical')).toHaveText(
    'Espressif Systems',
  );
  await expect(fieldRow(page, 'espnow-element-0-version').getByTestId('decode-field-physical')).toHaveText(
    'v1.0',
  );
  // v1.0'da More data alanı YOK — sürüm ayrımının ekrandaki kanıtı.
  await expect(fieldRow(page, 'espnow-element-0-more-data')).toHaveCount(0);
  await expect(fieldRow(page, 'espnow-element-0-body').getByTestId('decode-field-physical')).toHaveText(
    '"ALP Comm 18c"',
  );
  await expect(fieldRow(page, 'fcs')).toHaveAttribute('data-valid', 'true');
});

test('örnek 2 — tekli hedef, İKİ element: More data biti ayrı ayrı, birleştirilmiş yük satırı', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'unicast-two-elements');

  await expect(fieldRow(page, 'espnow-element-0-more-data').getByTestId('decode-field-physical')).toHaveText(
    'more elements follow in this frame',
  );
  await expect(fieldRow(page, 'espnow-element-1-more-data').getByTestId('decode-field-physical')).toHaveText(
    'last element of this payload',
  );
  await expect(fieldRow(page, 'espnow-element-0-version').getByTestId('decode-field-physical')).toHaveText(
    'v2.0',
  );
  await expect(fieldRow(page, 'espnow-payload-assembled')).toBeVisible();
});

test('örnek 3 — korumalı (CCMP): gövde "encrypted" damgasıyla durur, element alanı BAŞLAMAZ', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'protected');

  await expect(fieldRow(page, 'espnow-body').getByTestId('decode-field-physical')).toContainText(
    'encrypted',
  );
  await expect(fieldRow(page, 'espnow-category')).toHaveCount(0);
  await expect(frameWarning(page, tr['protocol.espNow.warning.encryptedPayload'])).toHaveCount(1);
});

test('örnek 4 — element OUI Espressif değil: unsupported-encoding hatası + uyarı', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'foreign-vendor-oui');

  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
    'data-error-code',
    'unsupported-encoding',
  );
  await expect(frameWarning(page, tr['protocol.espNow.warning.foreignVendorElement'])).toHaveCount(1);
});

test('unknownVendorElementDisplay: warn uyarı ekler, raw AYNI baytlarda eklemez', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'foreign-vendor-oui');

  await expect(frameWarning(page, tr['protocol.espNow.warning.foreignVendorElement'])).toHaveCount(1);
  await selectOption(page, 'unknownVendorElementDisplay', 'raw');
  await expect(frameWarning(page, tr['protocol.espNow.warning.foreignVendorElement'])).toHaveCount(0);
  await expect(fieldWarning(page, 'espnow-element-0')).toHaveCount(0);
});

test('örnek 5 — element Length çerçeveyi aşıyor: length-mismatch hatası + trailing bytes satırı', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'truncated-element-length');

  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
    'data-error-code',
    'length-mismatch',
  );
  await expect(fieldRow(page, 'espnow-element-trailing')).toBeVisible();
});

test('gerçek yakalama (espressif/esp-idf#2833): onaltılık şemada "Hello" + belgesiz baytlar', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'real-capture-hello');
  await selectOption(page, 'payloadSchema', 'hex');

  await expect(fieldRow(page, 'espnow-element-0-body').getByTestId('decode-field-raw')).toContainText(
    '48 65 6C 6C 6F C7 DB 01 44',
  );
  await expect(fieldRow(page, 'fcs')).toHaveAttribute('data-valid', 'true');
});

test('espNowVersion zorlaması: v1 nibble\'lı örnek v2 olarak yorumlanınca More data alanı ÇIKAR', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'broadcast-single-element');
  await expect(fieldRow(page, 'espnow-element-0-more-data')).toHaveCount(0);

  await selectOption(page, 'espNowVersion', 'v2');
  await expect(fieldRow(page, 'espnow-element-0-more-data')).toBeVisible();
  await expect(fieldRow(page, 'espnow-element-0-version').getByTestId('decode-field-physical')).toHaveText(
    'v2.0',
  );
});

test('girdi sözleşmesi her çözümde söylenir — radiotap KAPSAM DIŞI', async ({ page }) => {
  await openDecodePanel(page);
  await expect(frameWarning(page, tr['protocol.espNow.warning.radiotapOutOfScope'])).toHaveCount(1);
});

test('altı örneğin hiçbirinde çevrilmemiş ham anahtar sızmaz', async ({ page }) => {
  await openDecodePanel(page);
  const exampleIds = [
    'broadcast-single-element',
    'unicast-two-elements',
    'protected',
    'foreign-vendor-oui',
    'truncated-element-length',
    'real-capture-hello',
  ];
  for (const exampleId of exampleIds) {
    await selectExample(page, exampleId);
    await expectNoRawTranslationKeys(page);
  }
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await openDecodePanel(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${String(width)}px genişlikte yatay taşma`).toBeLessThanOrEqual(1);
  }
});
