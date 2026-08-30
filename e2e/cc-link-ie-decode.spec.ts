import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 13g'nin gerçek tarayıcı turu — CC-Link IE.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/industrial-
 * ethernet/cc-link-ie) **Kısmi** rozetiyle açıldığı (rozet ham `status`tan
 * değil `resolveStatus()`ten okunur — dalga 11 kuralı); 14 baytlık Field/
 * Control başlığının tam çözüldüğü; `protocolVerType`in iki nibble'ının ağ
 * tipini SÖYLEDİĞİ; iki kaynağın ANLAŞTIĞI TestData'da "tek kaynaklı" uyarısı
 * BASILMADIĞI ama TokenM'de basıldığı; HEC'in GÖSTERİLİP ama ASLA
 * DOĞRULANMADIĞI; döngüsel gövdenin TEK PARÇA ham kaldığı; TSN başlıklarının
 * tipe göre farklı boyda olduğu; acyclicData içindeki SLMP zarfının çözüldüğü;
 * ve IPv4 çerçevesinde "Field Basic bu telde gelmez" uyarısının basıldığı.
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır.
 * - `success:false` → `decode-parse-error` kartı (`decode-frame-error` DEĞİL).
 * - `decode-field-raw` sayıyı `0x… (…)` biçiminde basar.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/industrial-ethernet/cc-link-ie?tab=decode';

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

test.describe('CC-Link IE', () => {
  test('decode sekmesi KISMİ rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CC-Link IE');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'cc-link-ie');
    // Rozet ham `status`tan DEĞİL `resolveStatus()`ten gelir (dalga 11 kuralı).
    await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Field başlığını ve protocolVerType nibble’larını çözer', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'field-token-m');

    await expect(fieldRow(page, 'frame-type-14').getByTestId('decode-field-physical')).toHaveText(
      'TokenM',
    );
    await expect(fieldRow(page, 'src-node-number-20').getByTestId('decode-field-raw')).toHaveText(
      '0x1 (1)',
    );
    await expect(
      fieldRow(page, 'protocol-version-22').getByTestId('decode-field-physical'),
    ).toHaveText('CC-Link IE Field & Control, single master');
    await expect(fieldRow(page, 'protocol-type-22').getByTestId('decode-field-physical')).toHaveText(
      'CC-Link IE Field',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('HEC GÖSTERİLİR ama ASLA DOĞRULANMAZ: iki farklı örnek de hatasız kabul edilir', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'field-token-m');
    await expect(fieldRow(page, 'hec-24').getByTestId('decode-field-physical')).toHaveText(
      '0x12345678',
    );
    await expect(fieldWarning(page, 'hec-24')).toContainText(
      tr['protocol.ccLinkIe.warning.hecNotVerified'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);

    await selectExample(page, 'field-my-status');
    await expect(fieldRow(page, 'hec-24').getByTestId('decode-field-physical')).toHaveText(
      '0x00ABCDEF',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('tek kaynaklı orta alanlar uyarı taşır, iki kaynakta teyitli TestData taşımaz', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'field-my-status');
    await expect(fieldRow(page, 'sync-flag-18').getByTestId('decode-field-raw')).toHaveText(
      '0x13 (19)',
    );
    await expect(fieldWarning(page, 'sync-flag-18')).toContainText(
      tr['protocol.ccLinkIe.warning.middleFieldsSingleSource'],
    );

    await selectExample(page, 'field-test-data');
    await expect(fieldRow(page, 'pers-priority-16')).toHaveCount(1);
    await expect(fieldWarning(page, 'pers-priority-16')).toHaveCount(0);
    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.ccLinkIe.warning.middleFieldsSingleSource'] }),
    ).toHaveCount(0);
  });

  test('Control çerçevesinde 8.-9. baytlar protocolVerType DEĞİL ayrılmış alandır', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'control-token');

    await expect(fieldRow(page, 'frame-type-14').getByTestId('decode-field-physical')).toHaveText(
      'Token',
    );
    await expect(fieldRow(page, 'scan-number-16')).toHaveCount(1);
    await expect(fieldRow(page, 'protocol-type-22')).toHaveCount(0);
    await expect(fieldRow(page, 'reserved-22')).toHaveCount(1);
  });

  test('döngüsel gövde TEK PARÇA ham kalır ve nedeni uyarıyla söylenir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'field-cyclic-data-rwr');

    await expect(fieldRow(page, 'cyclic-data-28')).toHaveCount(1);
    await expect(fieldWarning(page, 'cyclic-data-28')).toContainText(
      tr['protocol.ccLinkIe.warning.cyclicLayoutFromNetworkParameters'],
    );
    // Gövdeden sahte alan türetilmiyor: 28'den sonra tek bir satır var.
    await expect(fieldRow(page, 'cyclic-data-60')).toHaveCount(0);
  });

  test('TSN: cyclicNo kontrol bayrağı ve tipe göre değişen başlık boyu', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'tsn-cyclic-ms');
    await expect(fieldRow(page, 'tsn-cyclic-no-15').getByTestId('decode-field-raw')).toHaveText(
      '0x5 (5)',
    );
    await expect(
      fieldRow(page, 'tsn-cyclic-no-check-flag-15').getByTestId('decode-field-physical'),
    ).toHaveText('enable');
    await expect(fieldRow(page, 'tsn-sa-16')).toHaveCount(1);
    await expect(fieldRow(page, 'hec-20')).toHaveCount(1);

    await selectExample(page, 'tsn-cyclic-ss-check-disabled');
    await expect(
      fieldRow(page, 'tsn-cyclic-no-check-flag-15').getByTestId('decode-field-physical'),
    ).toHaveText('disable');
    await expect(fieldRow(page, 'tsn-da-16')).toHaveCount(1);
    await expect(fieldRow(page, 'tsn-sa-16')).toHaveCount(0);

    // Detection başlığı yalnız İKİ bayttır — HEC alanı bile yok.
    await selectExample(page, 'tsn-acyclic-detection');
    await expect(fieldRow(page, 'frame-type-14').getByTestId('decode-field-physical')).toHaveText(
      'Detection',
    );
    await expect(fieldRow(page, 'hec-20')).toHaveCount(0);
    await expect(fieldWarning(page, 'tsn-detection-body-16')).toContainText(
      tr['protocol.ccLinkIe.warning.tsnDetectionBodyRaw'],
    );
  });

  test('TSN acyclicData içindeki SLMP zarfı çözülür, komut verisi ham kalır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'tsn-acyclic-data-slmp');

    await expect(
      fieldRow(page, 'slmp-subheader-20').getByTestId('decode-field-physical'),
    ).toHaveText('Request (3E frame)');
    await expect(
      fieldRow(page, 'slmp-monitoring-timer-29').getByTestId('decode-field-physical'),
    ).toHaveText('4000 ms');
    await expect(fieldRow(page, 'slmp-command-31').getByTestId('decode-field-raw')).toHaveText(
      '0x401 (1025)',
    );
    await expect(fieldWarning(page, 'slmp-data-35')).toContainText(
      tr['protocol.ccLinkIe.warning.slmpEnvelopeOnly'],
    );
  });

  test('IPv4 çerçevesi: Field Basic’in bu telde gelmediği açıkça söylenir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'ethertype-ipv4-field-basic');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'start-delimiter-not-found');
    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.ccLinkIe.warning.fieldBasicNotOnThisWire'] }),
    ).toHaveCount(1);
    await expect(fieldRow(page, 'destination-mac')).toHaveCount(1);
    await expect(fieldRow(page, 'frame-type-14')).toHaveCount(0);
  });

  test('adı olmayan çerçeve tipinde gövdeye DOKUNULMAZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'unknown-frame-type');

    await expect(fieldWarning(page, 'payload-15')).toContainText(
      tr['protocol.ccLinkIe.warning.frameTypeNotNamed'],
    );
    await expect(fieldRow(page, 'src-node-number-20')).toHaveCount(0);
  });

  test('çok kısa girdi decode-parse-error kartı basar (decode-frame-error DEĞİL)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    // 12 bayt: Ethernet başlığı bile tamamlanmıyor.
    await page.getByLabel(tr['decode.hexInput.label']).fill('00 00 00 00 00 01 00 11 11 11 11 11');

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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CC-Link IE');
    await expect(page.getByText(translations.en['status.partial'], { exact: true })).toBeVisible();

    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('tsn-acyclic-data-slmp');
    await expectNoRawTranslationKeys(page);

    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('ethertype-ipv4-field-basic');
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
