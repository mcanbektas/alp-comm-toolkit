import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 14b'nin gerçek tarayıcı turu — XCP on CAN.
 *
 * Kanıtladığı şeyler: kayıt Hazır rozetiyle açılıyor; `role` seçeneği AYNI
 * PID baytını (0xFF) `role=command`de CONNECT, `role=response`de RES olarak
 * FARKLI çözüyor (`xcpPacket.ts` dosya başı DÜZELTME 1); `byteOrder`
 * seçeneği SET_MTA'nın adresini little/big arasında FARKLI çözüyor
 * (DÜZELTME 2); hata yanıtının error_code'u tabloya adlanıyor;
 * `definitions` sekmesi A2L panelsiz "planlandı" bildirimi basıyor (panel
 * yok, `lin.ts`/`ldf` emsali).
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/automotive/calibration/xcp-on-can?tab=decode';
const DEFINITIONS_PATH = '/comm/automotive/calibration/xcp-on-can?tab=definitions';

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

test.describe('XCP on CAN katalog sayfası', () => {
  test('Hazır rozetiyle açılır, decodeOptions role+byteOrder ikisini de basar', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('XCP on CAN');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();

    await expect(page.locator('#decode-option-role')).toBeVisible();
    await expect(page.locator('#decode-option-byteOrder')).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('definitions sekmesi A2L panelsiz "planlandı" bildirimi basar', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(DEFINITIONS_PATH);
    await expect(page.getByText(tr['protocol.plannedNotice'], { exact: true })).toBeVisible();
  });
});

test.describe('XCP on CAN — role AYNI PID baytını farklı çözer', () => {
  test('varsayılan role=command: 0xFF → CONNECT', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    // İlk örnek zaten CONNECT (normal mode).
    await expect(fieldRow(page, 'pid').getByTestId('decode-field-physical')).toHaveText('CONNECT');
    await expect(fieldRow(page, 'connection-mode').getByTestId('decode-field-physical')).toHaveText('NORMAL');
  });

  test('role=response seçilince AYNI PID (0xFF) RES olarak okunur ve CONNECT gövdesi çözülür', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.locator('#decode-option-role').selectOption('response');
    await page.locator('#decode-example').selectOption('connect-positive-response');

    await expect(fieldRow(page, 'packet-code').getByTestId('decode-field-physical')).toHaveText(
      'positive-response',
    );
    await expect(fieldRow(page, 'max-cto').getByTestId('decode-field-raw')).toContainText('8');
  });

  test('role=response ile ERR yanıtının error_code’u tabloya adlanır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.locator('#decode-option-role').selectOption('response');
    await page.locator('#decode-example').selectOption('error-response-cmd-unknown');

    await expect(fieldRow(page, 'packet-code').getByTestId('decode-field-physical')).toHaveText('error');
    await expect(fieldRow(page, 'error-code').getByTestId('decode-field-physical')).toHaveText(
      'ERR_CMD_UNKNOWN',
    );
  });
});

test.describe('XCP on CAN — byteOrder aynı baytları farklı adrese çözer', () => {
  test('SET_MTA adresi little-endian ve big-endian arasında DEĞİŞİR', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.locator('#decode-example').selectOption('set-mta-command');

    const littleEndianRaw = await fieldRow(page, 'address').getByTestId('decode-field-raw').innerText();

    await page.locator('#decode-option-byteOrder').selectOption('big-endian');
    const bigEndianRaw = await fieldRow(page, 'address').getByTestId('decode-field-raw').innerText();

    expect(bigEndianRaw).not.toBe(littleEndianRaw);
  });
});

test.describe('XCP on CAN — STIM/DAQ ve tanımsız komut ham kalır', () => {
  test('0x00-0xBF aralığı STIM verisi olarak uyarılır, komut adı UYDURULMAZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.locator('#decode-example').selectOption('stim-daq-data');

    await expect(fieldRow(page, 'pid').getByTestId('decode-field-physical')).toContainText('STIM');
    await expect(
      page.locator('[data-testid="decode-field-warning"][data-field-id="pid"]'),
    ).toHaveCount(0); // uyarı çerçeve seviyesinde, alan seviyesinde değil — frame-warning ayrı kart.
    await expect(
      page.locator('[data-testid="decode-frame-warning"]').filter({ hasText: tr['protocol.xcp.warning.daqData'] }),
    ).toBeVisible();
  });
});

test.describe('XCP on CAN sayfası — düzen', () => {
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
