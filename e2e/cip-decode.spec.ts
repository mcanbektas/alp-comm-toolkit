import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 13d'nin gerçek tarayıcı turu — CIP.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/cip-can-based/
 * cip) Hazır rozetiyle açıldığı; Service/Reply Service ayrımının Reply
 * Service baytının 7. bitinden (kanal GEREKMEDEN) çözüldüğü; EPATH'in 16-bit
 * Class segmentindeki PAD BAYTININ ekranda gerçekten atlandığı (Instance
 * segmenti kaymadan doğru offsette çözülüyor); adlandırılmamış servis
 * kodunun uyarıyla ama GEÇERLİ olarak gösterildiği; kesik path'in çerçeve
 * uyarısı bastığı.
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır.
 * - `decode-field-raw` sayısal alanları `0x… (…)` biçiminde basar.
 * - `unit` yalnız `physicalValue` DOLUYSA değere yapıştırılır.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/cip-can-based/cip?tab=decode';

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

function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

function frameWarning(page: Page, text: string): Locator {
  return page.getByTestId('decode-frame-warning').filter({ hasText: text });
}

test.describe('CIP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CIP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'cip');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('8-bit istek: Service ve EPATH’in Class/Instance/Attribute segmentleri çözülür', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('get-attribute-single-request-8bit');

    await expect(fieldRow(page, 'service').getByTestId('decode-field-physical')).toHaveText(
      'Get_Attribute_Single',
    );
    await expect(fieldRow(page, 'path-class').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'path-instance').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(fieldRow(page, 'path-attribute').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('16-bit Class segmenti: PAD baytı atlanır, Instance kaymadan çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page
      .getByLabel(tr['decode.example.label'])
      .selectOption('get-attribute-all-request-16bit-class');

    await expect(fieldRow(page, 'path-class').getByTestId('decode-field-raw')).toHaveText('0x4 (4)');
    await expect(fieldRow(page, 'path-class').getByTestId('decode-field-physical')).toHaveText('Assembly');
    // PAD atlanmasaydı Instance segmenti offset 4 DEĞİL 5'te başlardı ve değeri yanlış okurdu.
    await expect(fieldRow(page, 'path-instance').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('yanıt: Reply Service’i 7. bitten tanır, General Status’u adlandırır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('get-attribute-single-response-success');

    await expect(fieldRow(page, 'reply-service').getByTestId('decode-field-physical')).toHaveText(
      'Get_Attribute_Single (Reply)',
    );
    await expect(fieldRow(page, 'general-status').getByTestId('decode-field-physical')).toHaveText(
      'Success',
    );
    await expect(fieldRow(page, 'service')).toHaveCount(0);
  });

  test('hata yanıtı: Path destination unknown adlandırılır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('response-path-destination-unknown');

    await expect(fieldRow(page, 'general-status').getByTestId('decode-field-physical')).toHaveText(
      'Path destination unknown',
    );
  });

  test('Connection Point segmenti EPATH’in dördüncü lojik alt tipi olarak çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('request-connection-point-segment');

    await expect(fieldRow(page, 'path-connection-point').getByTestId('decode-field-raw')).toHaveText(
      '0x65 (101)',
    );
  });

  test('adlandırılmamış servis kodu uyarır ama alan GEÇERLİ kalır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('request-unknown-service-code');

    await expect(fieldRow(page, 'service').getByTestId('decode-field-physical')).toHaveText('—');
    await expect(fieldRow(page, 'service').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.valid'],
    );
    await expect(fieldWarning(page, 'service')).toHaveText(tr['protocol.cip.warning.unknownService']);
  });

  test('kesik path çerçeve uyarısı basar', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('request-path-truncated');

    await expect(frameWarning(page, tr['protocol.cip.warning.pathTruncated'])).toHaveCount(1);
  });

  test('elle yapıştırılan hex çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    // Get_Attribute_Single(0x0E), Path Size=2 word, Class=1/Instance=1.
    await page.getByLabel(tr['decode.hexInput.label']).fill('0E 02 20 01 24 01');

    await expect(fieldRow(page, 'service').getByTestId('decode-field-physical')).toHaveText(
      'Get_Attribute_Single',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('tek baytlık girdi decode-parse-error kartı basar (decode-frame-error DEĞİL)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    // Service+Path Size bile yok — `success:false`.
    await page.getByLabel(tr['decode.hexInput.label']).fill('0E');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
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
