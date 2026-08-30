import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 13g'nin gerçek tarayıcı turu — AS-Interface (klasik).
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/classic-fieldbus/
 * as-interface) **Kısmi** rozetiyle açıldığı (rozet ham `status`tan değil
 * `resolveStatus()`ten okunur — dalga 11 kuralı); "çözülen nesil KLASİK AS-i,
 * ASi-5 DEĞİL" uyarısının HER çözümde göründüğü; 14 bitlik master çağrısının
 * her bitinin çözüldüğü; çift paritenin GERÇEKTEN doğrulandığı (bozuk parite
 * çerçeve hatası basar); adlandırılmamış komutun UYDURULMADIĞI; ve seçim
 * bitinin A/B slave iddiası taşımadığı.
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır.
 * - `success:false` → `decode-parse-error` kartı (`decode-frame-error` DEĞİL).
 * - `decode-field-raw` sayıyı `0x… (…)` biçiminde basar.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/classic-fieldbus/as-interface?tab=decode';

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

/** Alan uyarısı kökten aranır — `fieldRow(...)`un İÇİNDE DEĞİL, ayrı bir `<tr>`de. */
function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.getByLabel(tr['decode.example.label']).selectOption(exampleId);
}

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const text of await page.getByTestId(testId).allTextContents()) {
      expect(text.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test.describe('AS-Interface', () => {
  test('decode sekmesi KISMİ rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AS-Interface');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute(
      'data-plugin-id',
      'as-interface',
    );
    // Rozet ham `status`tan DEĞİL `resolveStatus()`ten gelir (dalga 11 kuralı).
    await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('her çözümde "klasik AS-i, ASi-5 değil" uyarısı görünür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'data-exchange-request');
    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.asInterface.warning.classicAsiOnly'] }),
    ).toHaveCount(1);

    await selectExample(page, 'data-exchange-response');
    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.asInterface.warning.classicAsiOnly'] }),
    ).toHaveCount(1);
  });

  test('14 bitlik master çağrısının her bitini çözer', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'data-exchange-request');

    await expect(fieldRow(page, 'start-bit').getByTestId('decode-field-physical')).toHaveText(
      'Valid (0)',
    );
    await expect(fieldRow(page, 'control-bit').getByTestId('decode-field-physical')).toHaveText(
      'Data / parameter transfer',
    );
    await expect(fieldRow(page, 'slave-address').getByTestId('decode-field-raw')).toHaveText(
      '0x5 (5)',
    );
    await expect(
      fieldRow(page, 'information-field').getByTestId('decode-field-physical'),
    ).toHaveText('0b01010');
    await expect(fieldRow(page, 'output-data').getByTestId('decode-field-physical')).toHaveText(
      '0b1010',
    );
    await expect(fieldRow(page, 'end-bit').getByTestId('decode-field-physical')).toHaveText(
      'Valid (1)',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('seçim biti gösterilir ama A/B slave İDDİA EDİLMEZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'data-exchange-request');

    const select = fieldRow(page, 'select-bit').getByTestId('decode-field-physical');
    await expect(select).not.toContainText('A-slave');
    await expect(select).not.toContainText('B-slave');
    await expect(fieldWarning(page, 'select-bit')).toContainText(
      tr['protocol.asInterface.warning.selectBitPolarityUnconfirmed'],
    );
  });

  test('çift parite GERÇEKTEN doğrulanır: bozuk parite çerçeve hatası basar', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'data-exchange-request');
    await expect(fieldRow(page, 'parity-bit').getByTestId('decode-field-physical')).toHaveText(
      'Even parity OK',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);

    await selectExample(page, 'parity-error');
    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
    await expect(fieldRow(page, 'parity-bit').getByTestId('decode-field-physical')).toHaveText(
      'Even parity MISMATCH',
    );
  });

  test('adres 0’da bilgi alanı veri değil YENİ ADRES taşır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'address-assignment');

    await expect(fieldRow(page, 'slave-address').getByTestId('decode-field-physical')).toHaveText(
      '0 (unconfigured slave)',
    );
    await expect(fieldRow(page, 'new-slave-address').getByTestId('decode-field-raw')).toHaveText(
      '0x7 (7)',
    );
    await expect(fieldRow(page, 'output-data')).toHaveCount(0);
    await expect(fieldWarning(page, 'slave-address')).toContainText(
      tr['protocol.asInterface.warning.addressZeroIsUnconfigured'],
    );
  });

  test('komut tablosundaki çağrılar adlandırılır, "reserved" olan UYDURULMAZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'read-io-configuration');
    await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText(
      'Read I/O Configuration',
    );

    await selectExample(page, 'broadcast-reset');
    await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText(
      'Broadcast (Reset)',
    );

    await selectExample(page, 'unnamed-command');
    await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText(
      '0b10111',
    );
    await expect(fieldWarning(page, 'command')).toContainText(
      tr['protocol.asInterface.warning.callNotNamed'],
    );
  });

  test('slave yanıtı çözülür ama ANLAMI iddia edilmez', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'data-exchange-response');

    await expect(fieldRow(page, 'response-data').getByTestId('decode-field-physical')).toHaveText(
      '0b0011',
    );
    await expect(fieldWarning(page, 'response-data')).toContainText(
      tr['protocol.asInterface.warning.responseMeaningNeedsRequest'],
    );
    await expect(fieldRow(page, 'slave-address')).toHaveCount(0);
  });

  test('sözleşme dışı uzunluk decode-parse-error kartı basar (decode-frame-error DEĞİL)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    // 3 bayt: ne 14 bitlik master çağrısı ne de 7 bitlik slave yanıtı.
    await page.getByLabel(tr['decode.hexInput.label']).fill('02 A9 00');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'length-mismatch',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AS-Interface');
    await expect(page.getByText(translations.en['status.partial'], { exact: true })).toBeVisible();

    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('data-exchange-request');
    await expectNoRawTranslationKeys(page);

    await page.getByLabel(translations.en['decode.example.label']).selectOption('parity-error');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'checksum-mismatch',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, DECODE_PATH);
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
