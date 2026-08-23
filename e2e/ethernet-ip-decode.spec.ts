import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 13d'nin gerçek tarayıcı turu — EtherNet/IP.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/industrial-
 * ethernet/ethernet-ip) Hazır rozetiyle açıldığı; encapsulation başlığının
 * (Command/Status) adlandırıldığı; SendRRData'nın CPF item'larının yüründüğü
 * VE Unconnected Data Item'ın içindeki CIP isteğinin `cip` motoruyla —
 * `cip-decode.spec.ts`teki AYNI alan adlarıyla (`cpf-item-2-cip-service`
 * öneki hariç) — çözüldüğü; SendUnitData'nın Connected Data Item'ında
 * Sequence Count'un CIP mesajından AYRI bir alan olarak basıldığı; CPF
 * item uzunluğu tamponu aşınca `decode-frame-error` (success:true+
 * valid:false, `decode-parse-error` DEĞİL) basıldığı.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/industrial-ethernet/ethernet-ip?tab=decode';

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

test.describe('EtherNet/IP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('EtherNet/IP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ethernet-ip');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Register Session isteği Command’ı adlandırır, Protocol Version’ı çözer', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('register-session-request');

    await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText(
      'Register Session',
    );
    await expect(fieldRow(page, 'status').getByTestId('decode-field-physical')).toHaveText('Success');
    await expect(fieldRow(page, 'protocol-version').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('SendRRData: CPF item’larını yürür, Unconnected Data Item’ı CIP motoruyla çözer', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('send-rr-data-get-attribute-single');

    await expect(fieldRow(page, 'cpf-item-count').getByTestId('decode-field-raw')).toHaveText('0x2 (2)');
    await expect(fieldRow(page, 'cpf-item-1-type').getByTestId('decode-field-physical')).toHaveText(
      'Null Address Item',
    );
    await expect(fieldRow(page, 'cpf-item-2-type').getByTestId('decode-field-physical')).toHaveText(
      'Unconnected Data Item',
    );
    // cip.ts'in ÜRETTİĞİ AYNI alan adları — yalnız önek farklı.
    await expect(fieldRow(page, 'cpf-item-2-cip-service').getByTestId('decode-field-physical')).toHaveText(
      'Get_Attribute_Single',
    );
    await expect(fieldRow(page, 'cpf-item-2-cip-path-class').getByTestId('decode-field-raw')).toHaveText(
      '0x1 (1)',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('SendUnitData: Connected Data Item’da Sequence Count CIP mesajından AYRI basılır', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('send-unit-data-connected-response');

    await expect(fieldRow(page, 'cpf-item-1-type').getByTestId('decode-field-physical')).toHaveText(
      'Connected Address Item',
    );
    await expect(
      fieldRow(page, 'cpf-item-1-connection-id').getByTestId('decode-field-raw'),
    ).toContainText('287454020');
    await expect(fieldRow(page, 'cpf-item-2-sequence-count').getByTestId('decode-field-raw')).toHaveText(
      '0x1 (1)',
    );
    // Sequence Count atlanmasaydı Reply Service baytı yanlış (0x01) okunurdu.
    await expect(
      fieldRow(page, 'cpf-item-2-cip-reply-service').getByTestId('decode-field-physical'),
    ).toHaveText('Get_Attribute_Single (Reply)');
    await expect(
      fieldRow(page, 'cpf-item-2-cip-general-status').getByTestId('decode-field-physical'),
    ).toHaveText('Success');
  });

  test('UnRegister Session command-specific veri taşımaz', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('unregister-session');

    await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText(
      'UnRegister Session',
    );
    await expect(fieldRow(page, 'command-data')).toHaveCount(0);
  });

  test('kesik CPF item’ı decode-frame-error basar (decode-parse-error DEĞİL)', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('send-rr-data-cpf-item-truncated');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
  });

  test('24 baytlık başlıktan kısa girdi decode-parse-error kartı basar', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.hexInput.label']).fill('65 00 00 00');

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
    await page.getByLabel(tr['decode.example.label']).selectOption('send-rr-data-get-attribute-single');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
