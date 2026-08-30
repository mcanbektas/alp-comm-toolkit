import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 5b'nin gerçek tarayıcı turu — IEC 60870-5-104.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/scada-utility/
 * iec-60870-5-104) Hazır rozetiyle açıldığı; U/S/I format çerçevelerinin, SQ=1
 * ardışık objelerin, C_IC_NA_1 komutunun, tanınmayan Type ID uyarısının,
 * start-baytı/length hata yollarının ekranda gerçekten çıktığı. IEC-104'ün
 * DNP3 gibi bir alias sayfası YOK (katalog "Katalog yolları" tablosu) — bu
 * yüzden alias devralma testi burada YOK. iec-60870-5-101 kaydı bu dalgada
 * `planned` kalıyor (Karar 3), o yüzden burada test edilmiyor.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/industrial-automation/scada-utility/iec-60870-5-104?tab=decode';

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

test.describe('IEC 60870-5-104', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IEC 60870-5-104');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'iec-60870-5-104');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('U-format STARTDT act örneği fonksiyonu basar, ASDU alanı yok', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('u-format-startdt-act');

    await expect(fieldRow(page, 'frame-format').getByTestId('decode-field-physical')).toHaveText(
      'U-format',
    );
    await expect(fieldRow(page, 'u-format-function').getByTestId('decode-field-physical')).toHaveText(
      'STARTDT act',
    );
    await expect(fieldRow(page, 'type-id')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('S-format onay örneği N(R)=3 basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('s-format-ack');

    await expect(fieldRow(page, 'frame-format').getByTestId('decode-field-physical')).toHaveText(
      'S-format',
    );
    await expect(fieldRow(page, 'receive-sequence-number').getByTestId('decode-field-raw')).toContainText(
      '3',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('I-format tek obje örneği M_SP_NA_1 SIQ’unu bit bit basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('i-format-single-object-spontaneous');

    await expect(fieldRow(page, 'type-id').getByTestId('decode-field-physical')).toHaveText(
      'M_SP_NA_1 — Single-point information',
    );
    await expect(fieldRow(page, 'cause-of-transmission').getByTestId('decode-field-physical')).toHaveText(
      'Spontaneous',
    );
    await expect(fieldRow(page, 'siq-spi').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'information-element')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('I-format SQ=1 ardışık obje örneği tek IOA + üç element basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('i-format-sequential-objects');

    await expect(fieldRow(page, 'information-object-address')).toHaveCount(1);
    await expect(fieldRow(page, 'information-object-address-0')).toHaveCount(0);
    await expect(fieldRow(page, 'siq-spi-0').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'siq-spi-1').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
    await expect(fieldRow(page, 'siq-iv-2').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('I-format genel sorgulama komutu örneği aktivasyonu basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('i-format-interrogation-command');

    await expect(fieldRow(page, 'type-id').getByTestId('decode-field-physical')).toHaveText(
      'C_IC_NA_1 — Interrogation command',
    );
    await expect(fieldRow(page, 'cause-of-transmission').getByTestId('decode-field-physical')).toHaveText(
      'Activation',
    );
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.iec104.warning.informationElementNeedsTypeDecode'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan Type ID örneği uyarı basar, çerçeve yine geçerli', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('i-format-unknown-type-id');

    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    // İki uyarı BİRLİKTE çıkar: Type ID tanınmıyor VE (count=1 yolu her zaman
    // "kalanı ham element say" kuralına gittiği için) eleman de ham gösterilir.
    await expect(
      page.getByTestId('decode-frame-warning').filter({ hasText: tr['protocol.iec104.warning.unknownTypeId'] }),
    ).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('start baytı hatası örneği start-delimiter-not-found basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('start-byte-invalid');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'start-delimiter-not-found');
    await expect(fieldRow(page, 'u-format-function').getByTestId('decode-field-physical')).toHaveText(
      'STARTDT act',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('length uyuşmazlığı örneği parse hatası kartı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('length-mismatch');

    const parseError = page.getByTestId('decode-parse-error');
    await expect(parseError).toBeVisible();
    await expect(parseError).toHaveAttribute('data-error-code', 'length-mismatch');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IEC 60870-5-104');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('length-mismatch');
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'length-mismatch',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('i-format-sequential-objects');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
