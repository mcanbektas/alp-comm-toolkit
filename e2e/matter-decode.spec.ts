import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 7d'nin gerçek tarayıcı turu — Matter TLV.
 *
 * Kanıtladığı şey: brief-faz10-dalga7.md'nin dalga sonu kararı (girdi bağımsız
 * TLV blob'udur — Matter Message framing YOK, şifreli+oturumlu; karar 9
 * `status: partial`) ekranda gerçekten görünüyor — TLV ağacı düz listeye
 * girintiyle indirgenir, her satırın ofseti HAM çerçeveye göredir (byte-viewer
 * drill-down şartı), tag kuralı ihlalleri hata değil uyarı basar. Bu protokolde
 * alias sayfası YOK (tek kanonik kayıt).
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/wireless-iot/mesh-smart-home/matter?tab=decode';

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  await page.goto(CANONICAL_DECODE_PATH);
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

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

test('decode sekmesi Kısmi rozetiyle açılır, konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Matter');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'matter');
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('SDK vektörü: gerçek Matter payload’ı ağaç olarak çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'identify-response');

  await expect(fieldRow(page, 'tlv-0')).toContainText('Structure');
  await expect(fieldRow(page, 'tlv-1').getByTestId('decode-field-physical')).toHaveText('9050');
  await expect(fieldRow(page, 'tlv-5').getByTestId('decode-field-physical')).toHaveText(
    '"04AA01AC231400LP"',
  );
  await expect(fieldRow(page, 'tlv-6').getByTestId('decode-field-physical')).toHaveText('"1.4rc5"');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('karışık tipli Array: iç içe container girintiyle gösterilir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'mixed-array');

  await expect(fieldRow(page, 'tlv-0')).toContainText('Array');
  await expect(fieldRow(page, 'tlv-1').getByTestId('decode-field-physical')).toHaveText('42');
  await expect(fieldRow(page, 'tlv-2').getByTestId('decode-field-physical')).toHaveText('-170000');
  await expect(fieldRow(page, 'tlv-3')).toContainText('Structure');
  await expect(fieldRow(page, 'tlv-5').getByTestId('decode-field-physical')).toHaveText('"Hello!"');
  // Derinlik ad içinde girintiyle: üyeler kökten daha içeride.
  await expect(fieldRow(page, 'tlv-1')).toContainText('··');
  await expectNoRawTranslationKeys(page);
});

test('fully-qualified tag vendor::profile:tag biçiminde gösterilir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'tag-forms');

  await expect(fieldRow(page, 'tlv-0')).toContainText('0xFFF1::0xDEED:1');
  await expect(fieldRow(page, 'tlv-1')).toContainText('0xFFF1::0xDEED:43605');
});

test('kapanmamış container hata basar ama kısmi ağaç yine görünür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'unclosed-container');

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute('data-error-code', 'truncated-frame');
  // Kısmi sonuç: kök + iki üye yine basılır.
  await expect(fieldRow(page, 'tlv-2')).toBeVisible();
  await expectNoRawTranslationKeys(page);
});

test('kesik string gövdesi value-out-of-range basar', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'truncated-string');

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
    'data-error-code',
    'value-out-of-range',
  );
  await expectNoRawTranslationKeys(page);
});

test('tag kuralı ihlali UYARI basar, çerçeve geçerli kalır', async ({ page }) => {
  await openDecodePanel(page);
  // Array üyesine context tag: spec A.5.2 ihlali — hata değil uyarı.
  await page.locator('#decode-hex').fill('16 20 00 2A 18');

  await expect(fieldWarning(page, 'tlv-1')).toContainText(
    tr['protocol.matter.warning.nonAnonymousTagInArray'],
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expect(fieldRow(page, 'tlv-1').getByTestId('decode-field-physical')).toHaveText('42');
  await expectNoRawTranslationKeys(page);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await selectExample(page, 'identify-response');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
