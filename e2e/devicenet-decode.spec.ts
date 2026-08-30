import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 13d'nin gerçek tarayıcı turu — DeviceNet.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/cip-can-based/
 * devicenet) Hazır rozetiyle açıldığı; CAN ID'nin Message Group'a göre
 * FARKLI genişlikte Message ID alanı taşıdığının (Group 1: 4 bit, Group 2:
 * 3 bit) gerçekten ekranda göründüğü; `payloadInterpretation` seçeneğinin
 * AYNI payload baytlarını `cip` motoruna devrettiği (Data alanı kaybolup
 * CIP alanlarının belirdiği); extended identifier'ın reddedildiği.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/cip-can-based/devicenet?tab=decode';

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

test.describe('DeviceNet', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DeviceNet');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'devicenet');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Group 1: 4-bit Message ID alanı doğru çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('group-1-poll-response-node-5');

    await expect(fieldRow(page, 'group').getByTestId('decode-field-physical')).toHaveText('Group 1');
    await expect(fieldRow(page, 'message-id').getByTestId('decode-field-raw')).toHaveText('0x5 (5)');
    await expect(fieldRow(page, 'mac-id').getByTestId('decode-field-raw')).toHaveText('0x5 (5)');
  });

  test('Group 2: 3-bit Message ID alanı FARKLI genişlikte çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('group-2-message-node-10');

    await expect(fieldRow(page, 'group').getByTestId('decode-field-physical')).toHaveText('Group 2');
    // 4-bit genişlik yanlışlıkla uygulansaydı Message ID 3 DEĞİL farklı çıkardı.
    await expect(fieldRow(page, 'message-id').getByTestId('decode-field-raw')).toHaveText('0x3 (3)');
    await expect(fieldRow(page, 'mac-id').getByTestId('decode-field-raw')).toHaveText('0xA (10)');
  });

  test('Group 3/4 üst bölgesi adlandırılmadan, ham sayı olarak gösterilir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('group-3-or-4-unnamed');

    await expect(fieldRow(page, 'group').getByTestId('decode-field-physical')).toHaveText('Group 3/4');
  });

  test('payloadInterpretation=raw (varsayılan): payload ham Data alanı olarak kalır', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page
      .getByLabel(tr['decode.example.label'])
      .selectOption('explicit-message-get-attribute-single');

    await expect(fieldRow(page, 'data')).toHaveCount(1);
    await expect(fieldRow(page, 'cip-service')).toHaveCount(0);
  });

  test('payloadInterpretation=cip-explicit: AYNI payload cip motoruyla çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page
      .getByLabel(tr['decode.example.label'])
      .selectOption('explicit-message-get-attribute-single');

    await page
      .getByLabel(tr['protocol.devicenet.option.payloadInterpretation'])
      .selectOption('cip-explicit');

    await expect(fieldRow(page, 'data')).toHaveCount(0);
    await expect(fieldRow(page, 'cip-service').getByTestId('decode-field-physical')).toHaveText(
      'Get_Attribute_Single',
    );
    await expect(fieldRow(page, 'cip-path-class').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  });

  test('extended identifier reddedilir ama çerçeve yine gösterilir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('extended-identifier-rejected');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
    await expect(fieldRow(page, 'group')).toHaveCount(0);
  });

  test('8 baytlık başlıktan kısa girdi decode-parse-error kartı basar', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.hexInput.label']).fill('00 00 00 00');

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
