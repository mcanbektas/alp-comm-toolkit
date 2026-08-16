import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 5c'nin gerçek tarayıcı turu — M-Bus.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/metering/m-bus)
 * Hazır rozetiyle açıldığı; dört çerçeve sınıfının (Single Character/Short/
 * Control/Long Frame) hepsinin, değişken veri yapısındaki (CI=0x72) DIF/VIF
 * kayıt zincirinin, checksum/L-kopyası/tanınmayan-CI hata-uyarı yollarının
 * ekranda gerçekten çıktığı; VE `building-automation/metering/m-bus` alias
 * sayfasının aynı motoru ve Hazır rozetini kanonik kayıttan devraldığı
 * (mqtt-decode.spec.ts'in alias deseninin aynısı, brief-faz10-dalga5.md
 * "Katalog yolları" tablosu).
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/industrial-automation/metering/m-bus?tab=decode';
const ALIAS_DECODE_PATH = '/comm/building-automation/metering/m-bus?tab=decode';

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

test.describe('M-Bus', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('M-Bus');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'm-bus');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Single Character ACK örneği tek alan basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('single-character-ack');

    await expect(fieldRow(page, 'ack').getByTestId('decode-field-physical')).toHaveText('ACK');
    await expect(fieldRow(page, 'c-field-function')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Short Frame REQ_UD2 örneği C/A alanlarını basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('short-frame-req-ud2');

    await expect(fieldRow(page, 'c-field-function').getByTestId('decode-field-physical')).toHaveText(
      'REQ_UD2',
    );
    await expect(fieldRow(page, 'c-field-dir').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'a-field').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'checksum')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Control Frame SND_NKE örneği tanınmayan CI uyarısı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('control-frame-snd-nke');

    await expect(fieldRow(page, 'c-field-function').getByTestId('decode-field-physical')).toHaveText(
      'SND_NKE',
    );
    await expect(fieldRow(page, 'ci-field')).toHaveCount(1);
    await expect(fieldRow(page, 'user-data')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.mbus.warning.unknownCi'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Long Frame değişken veri örneği DIF/VIF kayıtlarını mühendislik değerine çevirir', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('long-frame-rsp-ud-variable-data');

    await expect(
      fieldRow(page, 'fixed-header-identification-number').getByTestId('decode-field-raw'),
    ).toContainText('12345678');
    await expect(fieldRow(page, 'fixed-header-manufacturer').getByTestId('decode-field-physical')).toHaveText(
      'KAM',
    );
    await expect(fieldRow(page, 'fixed-header-medium').getByTestId('decode-field-physical')).toHaveText(
      'Heat (Outlet)',
    );

    await expect(fieldRow(page, 'vif-0').getByTestId('decode-field-physical')).toHaveText('Energy (Wh)');
    await expect(fieldRow(page, 'data-0').getByTestId('decode-field-physical')).toContainText('123456');

    await expect(fieldRow(page, 'vif-1').getByTestId('decode-field-physical')).toHaveText('Volume (m³)');
    await expect(fieldRow(page, 'data-1').getByTestId('decode-field-physical')).toContainText('12.565');

    await expect(fieldRow(page, 'vif-2').getByTestId('decode-field-physical')).toHaveText(
      'Flow Temperature (°C)',
    );
    await expect(fieldRow(page, 'data-2').getByTestId('decode-field-physical')).toContainText('23.5');

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan CI örneği user data’yı ham basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unrecognized-ci');

    await expect(fieldRow(page, 'ci-field')).toHaveCount(1);
    await expect(fieldRow(page, 'user-data')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.mbus.warning.unknownCi'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('checksum hatası örneği checksum-mismatch basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('checksum-mismatch');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
    await expect(fieldRow(page, 'c-field-function').getByTestId('decode-field-physical')).toHaveText(
      'REQ_UD2',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('L kopyası uyuşmazlığı örneği length-mismatch basar, alanlar yine çözülür', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('length-copies-mismatch');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'length-mismatch');
    await expect(fieldRow(page, 'c-field-function').getByTestId('decode-field-physical')).toHaveText(
      'SND_NKE',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('M-Bus');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('checksum-mismatch');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'checksum-mismatch',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('building-automation alias sayfası aynı motoru ve Hazır rozetini devralır', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, ALIAS_DECODE_PATH);

    // Alias kaydın kendi pluginId'si yok; motor kanonik kayda inilerek bulunur.
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'm-bus');
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: tr['protocol.canonical'] })).toBeVisible();

    await page.getByLabel(tr['decode.example.label']).selectOption('short-frame-req-ud2');
    await expect(fieldRow(page, 'c-field-function').getByTestId('decode-field-physical')).toHaveText(
      'REQ_UD2',
    );

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('long-frame-rsp-ud-variable-data');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
