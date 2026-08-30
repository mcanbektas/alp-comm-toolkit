import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 13a'nın gerçek tarayıcı turu — Wireless M-Bus.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/metering/
 * wireless-m-bus) Hazır rozetiyle açıldığı; EN 13757-4 Format A link-layer'ının
 * (L/C/M/A + Block CRC'leri) ve CI=0x72 yolunda wired M-Bus ile PAYLAŞILAN
 * Fixed Header/DIF/VIF motorunun ekranda gerçekten çalıştığı; çoklu-blok
 * çerçevelerin, şifreli payload'ın ("Encrypted", ŞİFRE ÇÖZÜLMEDEN) ve
 * desteklenmeyen CI yolunun doğru uyarı/karta düştüğü; radyo bağlamı
 * (decodeOptions) formunun alanlara yansıdığı; VE `wireless-iot/
 * wireless-metering/wireless-m-bus` alias sayfasının aynı motoru ve Hazır
 * rozetini kanonik kayıttan devraldığı (mbus-decode.spec.ts'in alias
 * deseninin aynısı).
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır —
 *   `[data-testid="decode-field-warning"][data-field-id="X"]` kökten aranır.
 * - `success:false` çerçevesi `decode-frame-error` DEĞİL `decode-parse-error`
 *   kartı basar.
 * - `decode-field-raw` tamsayıyı `0x2A (42)` diye biçimler; ondalık (12.565
 *   gibi) sayılar `Number.isInteger` testinden geçemediği için biçimlenmeden
 *   düz ondalık basılır — `toContainText` kullanılır, `toHaveText` değil.
 * - `unit` yalnız `physicalValue` DOLUYSA değere yapıştırılır.
 * - Birden çok çerçeve uyarısı varsa `getByTestId('decode-frame-warning')`
 *   strict-mode ihlali verir, `.filter({hasText})` ile süzülür.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/industrial-automation/metering/wireless-m-bus?tab=decode';
const ALIAS_DECODE_PATH = '/comm/wireless-iot/wireless-metering/wireless-m-bus?tab=decode';

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

function fieldWarnings(page: Page, fieldId: string): Locator {
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

test.describe('Wireless M-Bus', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wireless M-Bus');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'wireless-m-bus');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('basit örnek: Block 1/CI/Fixed Header/DIF-VIF alanları doğru çözülür', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('simple-unencrypted');

    await expect(fieldRow(page, 'l-field').getByTestId('decode-field-raw')).toHaveText('0x19 (25)');
    await expect(fieldRow(page, 'c-field-direction').getByTestId('decode-field-physical')).toHaveText(
      'From Meter',
    );
    await expect(fieldRow(page, 'm-field').getByTestId('decode-field-physical')).toHaveText('KAM');
    await expect(fieldRow(page, 'a-field-identification').getByTestId('decode-field-raw')).toContainText(
      '12345678',
    );
    await expect(fieldRow(page, 'a-field-device-type').getByTestId('decode-field-physical')).toHaveText(
      'Heat (Outlet)',
    );
    await expect(fieldRow(page, 'block1-crc').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.valid'],
    );

    await expect(fieldRow(page, 'ci-field').getByTestId('decode-field-physical')).toHaveText(
      'TPL: Long Header APL Follows',
    );
    await expect(fieldRow(page, 'security-mode').getByTestId('decode-field-physical')).toHaveText(
      'Not Encrypted',
    );

    // Paylaşılan motorun (mbusVariableData.ts) bastığı Fixed Header/DIF/VIF alanları.
    await expect(
      fieldRow(page, 'fixed-header-identification-number').getByTestId('decode-field-raw'),
    ).toContainText('12345678');
    await expect(fieldRow(page, 'vif-0').getByTestId('decode-field-physical')).toHaveText('Energy (Wh)');
    await expect(fieldRow(page, 'data-0').getByTestId('decode-field-physical')).toContainText('42');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('çoklu blok örneği üç kaydı da çözer ve offset-yaklaşıklığı uyarısı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('multi-block-three-records');

    await expect(fieldRow(page, 'data-block-0-crc').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.valid'],
    );
    await expect(fieldRow(page, 'data-block-1-crc').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.valid'],
    );

    await expect(fieldRow(page, 'vif-0').getByTestId('decode-field-physical')).toHaveText('Energy (Wh)');
    await expect(fieldRow(page, 'data-0').getByTestId('decode-field-physical')).toContainText('123456');
    await expect(fieldRow(page, 'vif-1').getByTestId('decode-field-physical')).toHaveText('Volume (m³)');
    await expect(fieldRow(page, 'data-1').getByTestId('decode-field-physical')).toContainText('12.565');
    await expect(fieldRow(page, 'vif-2').getByTestId('decode-field-physical')).toHaveText(
      'Flow Temperature (°C)',
    );
    await expect(fieldRow(page, 'data-2').getByTestId('decode-field-physical')).toContainText('23.5');

    await expect(
      page.getByTestId('decode-frame-warning').filter({ hasText: tr['protocol.wirelessMbus.warning.multiBlockOffsetApproximate'] }),
    ).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('şifreli örnek (Security Mode 5): header çözülür, payload "Encrypted" gösterilir, DIF/VIF BAŞLAMAZ', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('encrypted-mode-5');

    await expect(fieldRow(page, 'security-mode').getByTestId('decode-field-physical')).toContainText(
      'Mode 5',
    );
    await expect(fieldRow(page, 'fixed-header-manufacturer').getByTestId('decode-field-physical')).toHaveText(
      'KAM',
    );
    await expect(fieldRow(page, 'encrypted-payload').getByTestId('decode-field-physical')).toHaveText(
      'Encrypted',
    );
    await expect(fieldRow(page, 'vif-0')).toHaveCount(0);

    await expect(
      page.getByTestId('decode-frame-warning').filter({ hasText: tr['protocol.wirelessMbus.warning.encryptedPayload'] }),
    ).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Block 1 CRC hatası örneği crc-mismatch basar, alanlar yine çözülür', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('block1-crc-mismatch');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'crc-mismatch');
    await expect(fieldRow(page, 'block1-crc').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    // Checksum bozuk olsa da diğer alanlar yine çözülür (dürüstlük ilkesi).
    await expect(fieldRow(page, 'm-field').getByTestId('decode-field-physical')).toHaveText('KAM');
    await expectNoRawTranslationKeys(page);
  });

  test('desteklenmeyen CI (0x78) örneği APL payload’ı ham basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unsupported-ci');

    await expect(fieldRow(page, 'ci-field').getByTestId('decode-field-physical')).toHaveText(
      'TPL: No Header APL Follows',
    );
    await expect(fieldRow(page, 'apl-payload')).toHaveCount(1);
    await expect(fieldWarnings(page, 'apl-payload')).toContainText(tr['protocol.wirelessMbus.warning.ciNotDecoded']);
    await expect(fieldRow(page, 'fixed-header-identification-number')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('12 bayttan kısa elle girilen hex decode-parse-error kartı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.hexInput.label']).fill('44 2D 2C');

    await expect(page.getByTestId('decode-parse-error')).toBeVisible();
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('radyo bağlamı (decodeOptions) formu alanlara yansır', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('simple-unencrypted');

    await page.getByLabel(tr['protocol.wirelessMbus.option.radioMode']).selectOption('T1');
    await page.getByLabel(tr['protocol.wirelessMbus.option.rssi']).fill('-72');

    await expect(fieldRow(page, 'radio-mode').getByTestId('decode-field-raw')).toHaveText('T1');
    await expect(fieldRow(page, 'radio-rssi').getByTestId('decode-field-raw')).toContainText('-72');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wireless M-Bus');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('block1-crc-mismatch');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute('data-error-code', 'crc-mismatch');
    await expectNoRawTranslationKeys(page);
  });

  test('wireless-iot alias sayfası aynı motoru ve Hazır rozetini devralır', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, ALIAS_DECODE_PATH);

    // Alias kaydın kendi pluginId'si yok; motor kanonik kayda inilerek bulunur.
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'wireless-m-bus');
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: tr['protocol.canonical'] })).toBeVisible();

    await page.getByLabel(tr['decode.example.label']).selectOption('simple-unencrypted');
    await expect(fieldRow(page, 'm-field').getByTestId('decode-field-physical')).toHaveText('KAM');

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('multi-block-three-records');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
