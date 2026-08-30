import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 13h'nin gerçek tarayıcı turu — IO-Link.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/sensors-device-
 * integration/io-link) **Hazır** rozetiyle açıldığı (rozet ham `status`tan
 * değil `resolveStatus()`ten okunur — dalga 11 kuralı); `messageSide`
 * `decodeOptions`inin GERÇEKTEN alan yerleşimini değiştirdiği (aynı baytlar,
 * Master seçiliyken MC/CKT, Device seçiliyken CKS alanları); 6-bit checksum'ın
 * resmi formülle GERÇEKTEN doğrulandığı; ISDU'nun tek çerçeveye sığdığında
 * CHKPDU dahil TAM çözüldüğü; Type 2'nin PD/OD sınırının UYDURULMADIĞI; ve
 * Process Data içeriğinin IODD gerektirdiği için ham kaldığı.
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır.
 * - `success:false` → `decode-parse-error` kartı (`decode-frame-error` DEĞİL).
 * - `decode-field-raw` sayıyı `0x… (…)` biçiminde basar.
 * - `decodeOptions` alanları `getByLabel(tr['protocol.X.option.Y'])` ile
 *   bulunur (`decode-options` kapsayıcısı + `decode-options-hint`, bkz.
 *   `cc-link-decode.spec.ts`/`microwire-i3c-decode.spec.ts`).
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/sensors-device-integration/io-link?tab=decode';

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

async function selectMessageSide(page: Page, side: 'master' | 'device'): Promise<void> {
  const label = side === 'device' ? tr['protocol.ioLink.option.messageSide.device'] : tr['protocol.ioLink.option.messageSide.master'];
  await page.getByLabel(tr['protocol.ioLink.option.messageSide']).selectOption({ label });
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

test.describe('IO-Link', () => {
  test('decode sekmesi HAZIR rozetiyle açılır, decodeOptions ipucu görünür, konsola hata basmaz', async ({
    page,
  }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IO-Link');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'io-link');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    await expect(page.getByTestId('decode-options')).toBeVisible();
    await expect(page.getByTestId('decode-options-hint')).toHaveText(tr['decode.options.hint']);
    await expect(page.getByLabel(tr['protocol.ioLink.option.messageSide'])).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('messageSide GERÇEKTEN alan yerleşimini değiştirir: aynı baytlar Master ve Device olarak farklı çözülür', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'device-reply-with-payload-and-event');

    // Varsayılan: Master. Aynı baytlar MC/CKT alanlarını üretir, CKS'i ÜRETMEZ.
    await expect(fieldRow(page, 'mc-rw')).toBeVisible();
    await expect(fieldRow(page, 'cks-event')).toHaveCount(0);

    await selectMessageSide(page, 'device');
    await expect(fieldRow(page, 'cks-event')).toBeVisible();
    await expect(fieldRow(page, 'mc-rw')).toHaveCount(0);
    await expect(fieldRow(page, 'cks-event').getByTestId('decode-field-physical')).toHaveText(
      'Event pending',
    );
    await expect(fieldRow(page, 'cks-pd-status').getByTestId('decode-field-physical')).toHaveText(
      'Process Data invalid',
    );
    await expect(fieldWarning(page, 'payload')).toContainText(
      tr['protocol.ioLink.warning.devicePayloadKindUnknown'],
    );
  });

  test('MC ve CKT alanları çözülür: R/W, kanal, adres, M-sequence tipi', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'master-type1-process-data-write');

    await expect(fieldRow(page, 'mc-rw').getByTestId('decode-field-physical')).toHaveText('Write access');
    await expect(fieldRow(page, 'mc-channel').getByTestId('decode-field-physical')).toHaveText('Process');
    await expect(fieldRow(page, 'ckt-type').getByTestId('decode-field-physical')).toHaveText('Type 1');
    await expect(fieldRow(page, 'process-data')).toBeVisible();
    await expect(fieldWarning(page, 'process-data')).toContainText(
      tr['protocol.ioLink.warning.processDataNeedsIodd'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('6-bit checksum resmi formülle GERÇEKTEN doğrulanır: bozuk checksum çerçeve hatası basar', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);

    await selectExample(page, 'master-type1-process-data-write');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('Checksum OK');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);

    await selectExample(page, 'master-checksum-mismatch');
    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toContainText('Expected');
  });

  test('ISDU tek çerçeveye sığınca CHKPDU dahil TAM çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'master-type1-isdu-write-response-positive');

    await expect(fieldRow(page, 'isdu-i-service').getByTestId('decode-field-physical')).toHaveText(
      'Write Response (positive)',
    );
    await expect(fieldRow(page, 'isdu-chkpdu').getByTestId('decode-field-physical')).toHaveText('CHKPDU OK');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);

    await selectExample(page, 'master-isdu-chkpdu-mismatch');
    await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('Checksum OK');
    await expect(fieldRow(page, 'isdu-chkpdu').getByTestId('decode-field-physical')).toHaveText(
      'CHKPDU mismatch',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute('data-error-code', 'checksum-mismatch');
  });

  test('segmentli ISDU fragmanı ham bırakılır, UYDURULMAZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'master-type0-isdu-fragment');

    await expect(fieldRow(page, 'isdu-i-service')).toHaveCount(0);
    await expect(fieldRow(page, 'on-request-data')).toBeVisible();
    await expect(fieldWarning(page, 'on-request-data')).toContainText(
      tr['protocol.ioLink.warning.onRequestDataNotDecoded'],
    );
  });

  test('Type 2 gövdesi tek parça ham gösterilir, PD/OD sınırı UYDURULMAZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'master-type2-combined');

    await expect(fieldRow(page, 'combined-data')).toBeVisible();
    await expect(fieldRow(page, 'process-data')).toHaveCount(0);
    await expect(fieldRow(page, 'on-request-data')).toHaveCount(0);
    await expect(fieldWarning(page, 'combined-data')).toContainText(
      tr['protocol.ioLink.warning.type2PayloadSplitUnknown'],
    );
  });

  test('ayrılmış M-sequence tipi işaretlenir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'master-type-reserved');

    await expect(fieldRow(page, 'ckt-type').getByTestId('decode-field-physical')).toHaveText('Reserved');
    await expect(fieldWarning(page, 'ckt-type')).toContainText(
      tr['protocol.ioLink.warning.mSequenceTypeReserved'],
    );
  });

  test('sözleşme dışı kısa girdi decode-parse-error kartı basar (decode-frame-error DEĞİL)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.hexInput.label']).fill('92');

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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IO-Link');
    await expect(page.getByText(translations.en['status.ready'], { exact: true })).toBeVisible();

    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('master-type1-isdu-write-response-positive');
    await expectNoRawTranslationKeys(page);

    await page
      .getByLabel(translations.en['protocol.ioLink.option.messageSide'])
      .selectOption({ label: translations.en['protocol.ioLink.option.messageSide.device'] });
    await page
      .getByLabel(translations.en['decode.example.label'])
      .selectOption('device-reply-with-payload-and-event');
    await expectNoRawTranslationKeys(page);

    await page.getByLabel(translations.en['decode.example.label']).selectOption('master-checksum-mismatch');
    await page
      .getByLabel(translations.en['protocol.ioLink.option.messageSide'])
      .selectOption({ label: translations.en['protocol.ioLink.option.messageSide.master'] });
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute('data-error-code', 'checksum-mismatch');
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
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
