import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 13g'nin gerçek tarayıcı turu — CC-Link (klasik).
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/classic-fieldbus/
 * cc-link) **Kısmi** rozetiyle açıldığı (rozet ham `status`tan değil
 * `resolveStatus()`ten okunur — dalga 11 kuralı); "çözülen şey RS-485 telgrafı
 * DEĞİLDİR" uyarısının HER çözümde göründüğü; RX bit noktalarının onaltılık
 * adlarla çözüldüğü; üç `decodeOptions` kanalının gerçekten yerleşimi
 * değiştirdiği (yön → RY/RWw, genişletilmiş çevrim → beklenen bayt sayısı);
 * ve fazla/eksik baytta sahte alan üretilmediği.
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır.
 * - `success:false` → `decode-parse-error` kartı (`decode-frame-error` DEĞİL).
 * - `decode-field-raw` sayıyı `0x… (…)` biçiminde basar.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/classic-fieldbus/cc-link?tab=decode';

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

/** 16-bit little-endian kelimeleri hex girdi metnine çevirir. */
function hexWords(...values: readonly number[]): string {
  return values
    .flatMap((value) => [value & 0xff, (value >>> 8) & 0xff])
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
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

test.describe('CC-Link', () => {
  test('decode sekmesi KISMİ rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CC-Link');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'cc-link');
    // Rozet ham `status`tan DEĞİL `resolveStatus()`ten gelir (dalga 11 kuralı).
    await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('her çözümde "çözülen şey telgraf değildir" uyarısı görünür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'remote-device-typical');

    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.ccLink.warning.linkLayerNotPublic'] }),
    ).toHaveCount(1);
    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.ccLink.warning.wordOrderAssumption'] }),
    ).toHaveCount(1);
  });

  test('RX bit noktalarını onaltılık adlarla, yazmaçları little-endian çözer', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'remote-device-typical');

    await expect(fieldRow(page, 'rx-word-0').getByTestId('decode-field-physical')).toHaveText(
      'RX0000 · RX0002',
    );
    await expect(fieldRow(page, 'rx-word-2').getByTestId('decode-field-physical')).toHaveText(
      'RX0011',
    );
    await expect(fieldRow(page, 'rwr-0').getByTestId('decode-field-raw')).toHaveText('0xFA (250)');
    await expect(fieldRow(page, 'rwr-1').getByTestId('decode-field-physical')).toHaveText('0x1234');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);

    // Nokta ADLANDIRILIR ama ANLAMLANDIRILMAZ — bu her alanda söylenir.
    await expect(fieldWarning(page, 'rwr-1')).toContainText(
      tr['protocol.ccLink.warning.pointMeaningFromDeviceProfile'],
    );
  });

  test('kapalı kelime "—" basar, tümü açık kelime on altı nokta adı listeler', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'remote-device-all-off');
    await expect(fieldRow(page, 'rx-word-0').getByTestId('decode-field-physical')).toHaveText('—');

    await selectExample(page, 'remote-device-all-on');
    const allOn = fieldRow(page, 'rx-word-2').getByTestId('decode-field-physical');
    await expect(allOn).toContainText('RX0010');
    await expect(allOn).toContainText('RX001F');
  });

  test('yön seçeneği alanları RY/RWw olarak yeniden adlandırır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'remote-device-typical');
    await expect(fieldRow(page, 'rx-word-0')).toHaveCount(1);

    await page
      .getByLabel(tr['protocol.ccLink.option.direction'])
      .selectOption('master-to-slave');

    await expect(fieldRow(page, 'ry-word-0')).toHaveCount(1);
    await expect(fieldRow(page, 'rx-word-0')).toHaveCount(0);
    await expect(fieldRow(page, 'ry-word-0').getByTestId('decode-field-physical')).toHaveText(
      'RY0000 · RY0002',
    );
    await expect(fieldRow(page, 'rww-1').getByTestId('decode-field-physical')).toHaveText('0x1234');
  });

  test('genişletilmiş çevrim seçeneği beklenen bayt sayısını gerçekten değiştirir', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'remote-device-typical');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);

    // ×2 → 32 bit (4 bayt) + 8 yazmaç (16 bayt) = 20 bayt beklenir; 12 bayt kesik.
    await page.getByLabel(tr['protocol.ccLink.option.extendedCyclic']).selectOption('x2');
    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.ccLink.warning.extendedCyclicIsVer2'] }),
    ).toHaveCount(1);

    // Doğru boyda bir görüntü verilince hata kalkar ve sekizinci yazmaç görünür.
    await page
      .getByLabel(tr['decode.hexInput.label'])
      .fill(hexWords(0x0003, 0x0000, 1, 2, 3, 4, 5, 6, 7, 8));
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(fieldRow(page, 'rwr-7').getByTestId('decode-field-raw')).toHaveText('0x8 (8)');
  });

  test('kesik görüntüde eksik alanlar UYDURULMAZ, hata basılır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'image-truncated');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
    await expect(fieldRow(page, 'rx-word-0')).toHaveCount(1);
    await expect(fieldRow(page, 'rwr-3')).toHaveCount(0);
  });

  test('fazladan baytlar ham blok olarak gösterilir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'image-trailing-bytes');

    await expect(fieldRow(page, 'trailing-12')).toHaveCount(1);
    await expect(fieldWarning(page, 'trailing-12')).toContainText(
      tr['protocol.ccLink.warning.trailingBytes'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('boş girdi decode-parse-error kartı basar (decode-frame-error DEĞİL)', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.hexInput.label']).fill('');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CC-Link');
    await expect(page.getByText(translations.en['status.partial'], { exact: true })).toBeVisible();

    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('remote-device-typical');
    await expectNoRawTranslationKeys(page);

    await page.getByLabel(translations.en['decode.example.label']).selectOption('image-truncated');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
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
