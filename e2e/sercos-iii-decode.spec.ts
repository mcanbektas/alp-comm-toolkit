import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 13f'nin gerçek tarayıcı turu — Sercos III.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/industrial-
 * ethernet/sercos-iii) Hazır rozetiyle açıldığı; 6 baytlık Sercos başlığının
 * (kanal/tip/cycle-valid/numara, faz, CRC32) tam çözüldüğü; telgraf numarasının
 * genişliği konusunda iki kaynağın ANLAŞMADIĞI bit 2-3'ün AYRI bir alanda
 * gösterildiği; CRC32'nin GÖSTERİLİP ama ASLA DOĞRULANMADIĞI (iki farklı örnek
 * çerçevede iki farklı, gerçek olmayan CRC değeri de hatasız kabul ediliyor);
 * CP1/CP2'nin 128 cihazlık servis kanalının ilk cihazlarda gerçekten çözüldüğü;
 * CP3/CP4'te yalnız Hot-Plug alanının çözülüp gerisinin CP2 pazarlığından
 * geldiği için TEK PARÇA ham kaldığı.
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır.
 * - `success:false` → `decode-parse-error` kartı (`decode-frame-error` DEĞİL).
 * - `decode-field-raw` sayıyı `0x… (…)` biçiminde basar.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/industrial-ethernet/sercos-iii?tab=decode';

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

function fieldOffsetCell(page: Page, fieldId: string): Locator {
  return fieldRow(page, fieldId).locator('td').nth(1);
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

test.describe('Sercos III', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sercos III');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'sercos-iii');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('MDT/AT ayrımını ve kanal/faz alanlarını çözer', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'mdt0-cp4-operational');

    await expect(fieldRow(page, 'telegram-kind-14').getByTestId('decode-field-physical')).toHaveText(
      'MDT (master data telegram)',
    );
    await expect(
      fieldRow(page, 'telegram-channel-14').getByTestId('decode-field-physical'),
    ).toHaveText('P-Telegram (primary port)');
    await expect(
      fieldRow(page, 'communication-phase-15').getByTestId('decode-field-physical'),
    ).toHaveText('CP4');
    await expect(fieldRow(page, 'communication-phase-15').getByTestId('decode-field-raw')).toHaveText(
      '0x4 (4)',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);

    await selectExample(page, 'at0-cp4-operational');
    await expect(fieldRow(page, 'telegram-kind-14').getByTestId('decode-field-physical')).toHaveText(
      'AT (device telegram)',
    );
  });

  test('telgraf numarası: iki kaynağın ANLAŞMADIĞI bit 2-3 AYRI bir alanda gösterilir', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'telegram-number-extended-bits');

    await expect(fieldRow(page, 'telegram-number-14').getByTestId('decode-field-raw')).toHaveText(
      '0x2 (2)',
    );
    const extended = fieldRow(page, 'telegram-number-extended-14');
    await expect(extended.getByTestId('decode-field-raw')).toHaveText('0x3 (3)');
    await expect(fieldWarning(page, 'telegram-number-extended-14')).toContainText(
      tr['protocol.sercosIii.warning.telegramNumberWidthConflict'],
    );
  });

  test('CRC32 GÖSTERİLİR ama ASLA DOĞRULANMAZ: iki farklı örnek de hatasız kabul edilir', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'mdt0-cp4-operational');
    await expect(fieldRow(page, 'header-crc32-16').getByTestId('decode-field-physical')).toHaveText(
      '0x1A2B3C4D',
    );
    await expect(fieldWarning(page, 'header-crc32-16')).toContainText(
      tr['protocol.sercosIii.warning.crc32NotVerified'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);

    await selectExample(page, 'at0-cp4-operational');
    await expect(fieldRow(page, 'header-crc32-16').getByTestId('decode-field-physical')).toHaveText(
      '0x4D3C2B1A',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('CP0: MDT Communication Version ham hex, AT tanınan cihaz sayısını türetir', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'mdt0-cp0-communication-version');

    await expect(
      fieldRow(page, 'cp0-communication-version-20').getByTestId('decode-field-physical'),
    ).toHaveText('0x00300100');
    await expect(fieldWarning(page, 'cp0-communication-version-20')).toContainText(
      tr['protocol.sercosIii.warning.versionFieldBitsSingleSource'],
    );

    await selectExample(page, 'at0-cp0-recognized-devices');
    await expect(
      fieldRow(page, 'cp0-sequence-counter-20').getByTestId('decode-field-physical'),
    ).toHaveText('3 recognized device(s)');
    await expect(fieldWarning(page, 'cp0-recognized-device-list-22')).toContainText(
      tr['protocol.sercosIii.warning.recognizedDeviceListRaw'],
    );
  });

  test('CP1/CP2: servis kanalı kelimesi ve C-DEV kontrol kelimesi ilk cihazlarda çözülür', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'mdt0-cp2-service-channel');

    await expect(fieldOffsetCell(page, 'svc-0-word-20')).toHaveText('20');
    await expect(fieldRow(page, 'svc-0-word-20').getByTestId('decode-field-physical')).toHaveText(
      'MHS=1 · Write · EOT=0 · DBE=IDN',
    );
    await expect(
      fieldRow(page, 'device-0-word-788').getByTestId('decode-field-physical'),
    ).toHaveText('Ident LED · TopologyHS=0 · Fast forward on both ports · Ring closed · Master valid');
    // 16 cihazdan sonrası tek parça ham; uyarı hem alanda hem çerçevede görünür.
    await expect(fieldWarning(page, 'svc-region-remainder-116')).toContainText(
      tr['protocol.sercosIii.warning.detailedDeviceLimit'],
    );
    await expect(fieldRow(page, 'device-16-word-852')).toHaveCount(0);
  });

  test('CP3/CP4: yalnız Hot-Plug alanı çözülür, gerisi CP2 pazarlığından geldiği için TEK PARÇA ham', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'mdt0-cp4-operational');

    await expect(fieldRow(page, 'hot-plug-address-20').getByTestId('decode-field-raw')).toHaveText(
      '0x5 (5)',
    );
    await expect(fieldRow(page, 'hot-plug-word-22').getByTestId('decode-field-physical')).toHaveText(
      '0x0100',
    );
    await expect(fieldWarning(page, 'hot-plug-word-22')).toContainText(
      tr['protocol.sercosIii.warning.hotPlugBitsSingleSource'],
    );
    await expect(fieldWarning(page, 'cp34-payload-28')).toContainText(
      tr['protocol.sercosIii.warning.cp34LayoutFromCp2'],
    );
  });

  test('adı olmayan haberleşme fazı ham gösterilir ve nedeni uyarıyla söylenir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'unknown-phase');

    const phase = fieldRow(page, 'communication-phase-15');
    await expect(phase.getByTestId('decode-field-physical')).toHaveText('0x07');
    await expect(fieldWarning(page, 'payload-20')).toContainText(
      tr['protocol.sercosIii.warning.phaseNotNamed'],
    );
  });

  test('yanlış EtherType: MAC alanları çözülür ama Sercos başlığına DOKUNULMAZ', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'ethertype-not-sercos');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'start-delimiter-not-found');
    await expect(fieldRow(page, 'destination-mac')).toHaveCount(1);
    await expect(fieldRow(page, 'communication-phase-14')).toHaveCount(0);
  });

  test('çok kısa girdi decode-parse-error kartı basar (decode-frame-error DEĞİL)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    // Ethernet başlığı var (14 bayt) ama 6 baytlık Sercos başlığı yok.
    await page.getByLabel(tr['decode.hexInput.label']).fill(
      'FF FF FF FF FF FF 02 00 00 53 33 01 88 CD',
    );

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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sercos III');

    await page.getByLabel(translations.en['decode.example.label']).selectOption('mdt0-cp2-service-channel');
    await expectNoRawTranslationKeys(page);

    await page.getByLabel(translations.en['decode.example.label']).selectOption('ethertype-not-sercos');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'start-delimiter-not-found',
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
