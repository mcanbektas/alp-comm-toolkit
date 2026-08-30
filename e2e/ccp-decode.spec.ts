import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 14c'nin gerçek tarayıcı turu — CCP.
 *
 * Kanıtladığı şeyler: kayıt Hazır rozetiyle açılıyor; varsayılan
 * `frameInterpretation=raw` genel bir Data alanı basıyor; `cro` şıkkı
 * Command/Counter/parametre alanlarını, `dto` şıkkı Packet ID/Return
 * Code/Counter alanlarını açıyor; HER başarılı çözümde (şık ne olursa olsun)
 * koşulsuz legacy uyarısı ekranda görünüyor ve `related` xcp-on-can'a
 * yönlendiriyor.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/automotive/calibration/ccp?tab=decode';

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

function frameWarning(page: Page, text: string): Locator {
  // Tuzak (12d/12e): birden çok çerçeve uyarısı varsa getByTestId tek başına strict-mode ihlali verir.
  return page.locator('[data-testid="decode-frame-warning"]').filter({ hasText: text });
}

test.describe('CCP katalog sayfası', () => {
  test('Hazır rozetiyle açılır, decodeOptions frameInterpretation basar', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CCP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ccp');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();

    await expect(page.locator('#decode-option-frameInterpretation')).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });
});

test.describe('CCP — koşulsuz legacy uyarısı', () => {
  test('varsayılan raw modda bile HER başarılı çözümde görünür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await expect(frameWarning(page, tr['protocol.ccp.warning.legacyProtocol'])).toBeVisible();
  });

  test('cro ve dto şıklarında da görünür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await page.locator('#decode-option-frameInterpretation').selectOption('cro');
    await expect(frameWarning(page, tr['protocol.ccp.warning.legacyProtocol'])).toBeVisible();

    await page.locator('#decode-option-frameInterpretation').selectOption('dto');
    await page.locator('#decode-example').selectOption('connect-crm-ack');
    await expect(frameWarning(page, tr['protocol.ccp.warning.legacyProtocol'])).toBeVisible();
  });
});

test.describe('CCP — decodeOptions: frameInterpretation=raw (varsayılan)', () => {
  test('tek genel Data alanı gösterir, Command/Packet ID alanı YOK', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await expect(fieldRow(page, 'data')).toHaveCount(1);
    await expect(fieldRow(page, 'command')).toHaveCount(0);
    await expect(fieldRow(page, 'packet-id')).toHaveCount(0);
  });
});

test.describe('CCP — decodeOptions: frameInterpretation=cro', () => {
  test('CONNECT komutu adlanır, station address little-endian çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.locator('#decode-option-frameInterpretation').selectOption('cro');
    await page.locator('#decode-example').selectOption('connect-cro');

    await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText('CONNECT');
    await expect(fieldRow(page, 'station-address').getByTestId('decode-field-raw')).toContainText('4660'); // 0x1234
  });

  test('SET_MTA adresi Motorola/big-endian ile çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.locator('#decode-option-frameInterpretation').selectOption('cro');
    await page.locator('#decode-example').selectOption('set-mta-cro');

    await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText('SET_MTA');
    await expect(fieldRow(page, 'address').getByTestId('decode-field-raw')).toContainText('8192'); // 0x00002000
  });

  test('tabloda olmayan komut kodu Unassigned gösterir, isim UYDURULMAZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.locator('#decode-option-frameInterpretation').selectOption('cro');
    await page.locator('#decode-example').selectOption('unassigned-command-cro');

    await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toContainText('Unassigned');
  });
});

test.describe('CCP — decodeOptions: frameInterpretation=dto', () => {
  test('0xFF Command Return Message olarak adlanır, Return Code tabloya çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.locator('#decode-option-frameInterpretation').selectOption('dto');
    await page.locator('#decode-example').selectOption('connect-crm-ack');

    await expect(fieldRow(page, 'packet-id').getByTestId('decode-field-physical')).toContainText(
      'Command Return Message',
    );
    await expect(fieldRow(page, 'return-code').getByTestId('decode-field-physical')).toHaveText('ACKNOWLEDGE');
  });

  test('DAQ verisi (0x02) PID olarak adlanır, içerik ham kalır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.locator('#decode-option-frameInterpretation').selectOption('dto');
    await page.locator('#decode-example').selectOption('daq-data-dto');

    await expect(fieldRow(page, 'packet-id').getByTestId('decode-field-physical')).toContainText('DAQ data');
    await expect(fieldRow(page, 'daq-data')).toHaveCount(1);
  });
});

test.describe('CCP — boş payload', () => {
  test('DLC=0 decode-frame-error basar (decode-parse-error DEĞİL)', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.locator('#decode-example').selectOption('empty-payload');

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
  });
});

test.describe('CCP sayfası — düzen', () => {
  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(DECODE_PATH);
    await expect(page.getByTestId('decode-panel')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
