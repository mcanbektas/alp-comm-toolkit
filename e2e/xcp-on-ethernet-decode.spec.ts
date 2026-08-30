import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 14c'nin gerçek tarayıcı turu — XCP on Ethernet.
 *
 * Kanıtladığı şeyler: kayıt Hazır rozetiyle açılıyor; `role`/`byteOrder`
 * seçenekleri `xcp-on-can`dan PAYLAŞILAN AYNI form alanlarını basıyor (aynı
 * id'ler: `#decode-option-role`, `#decode-option-byteOrder`) ve AYNI PID
 * baytını farklı yorumluyor; taşıma başlığının `length`/`counter` alanları
 * HAM kalıyor (rawValue yok, "—" gösteriliyor) ve iki bağımsız kaynağın
 * (Scapy/pyxcp) bayt sırasında çeliştiğini söyleyen uyarı ekranda görünüyor.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/automotive/calibration/xcp-on-ethernet?tab=decode';
const DEFINITIONS_PATH = '/comm/automotive/calibration/xcp-on-ethernet?tab=definitions';

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
  // Tuzak (12d/12e): alan uyarısı ayrı bir öğede basılır, fieldRow().getByTestId(...) BOŞ döner.
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

test.describe('XCP on Ethernet katalog sayfası', () => {
  test('Hazır rozetiyle açılır, decodeOptions role+byteOrder ikisini de basar', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('XCP on Ethernet');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'xcp-on-ethernet');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();

    await expect(page.locator('#decode-option-role')).toBeVisible();
    await expect(page.locator('#decode-option-byteOrder')).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('definitions sekmesi A2L panelini açar — kaydın beklediği tanım geldi', async ({ page }) => {
    // Kayıt "Ham DTO baytları A2L olmadan anlamsızdır" diyerek A2L Import'u
    // ertelemişti; motor yazılınca beklenti de döndü. Bildirim artık DÜŞER.
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(DEFINITIONS_PATH);
    await expect(page.getByTestId('a2l-panel')).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'], { exact: true })).toHaveCount(0);
  });
});

test.describe('XCP on Ethernet — taşıma başlığı HAM kalır (iki kaynak çelişiyor)', () => {
  test('length/counter alanları "—" gösterir ve headerByteOrderUnresolved uyarısı taşır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);

    await expect(fieldRow(page, 'length').getByTestId('decode-field-raw')).toHaveText('—');
    await expect(fieldRow(page, 'counter').getByTestId('decode-field-raw')).toHaveText('—');

    await expect(fieldWarning(page, 'length')).toHaveCount(1);
    await expect(fieldWarning(page, 'counter')).toHaveCount(1);

    await expect(
      page
        .locator('[data-testid="decode-frame-warning"]')
        .filter({ hasText: tr['protocol.xcpEth.warning.headerByteOrderUnresolved'] }),
    ).toBeVisible();
  });
});

test.describe('XCP on Ethernet — role AYNI PID baytını farklı çözer', () => {
  test('varsayılan role=command: 0xFF → CONNECT, PID ofseti 4’ten başlar', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await expect(fieldRow(page, 'pid').getByTestId('decode-field-physical')).toHaveText('CONNECT');
    await expect(fieldRow(page, 'pid').locator('td').nth(1)).toHaveText('4');
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

    await expect(fieldRow(page, 'error-code').getByTestId('decode-field-physical')).toHaveText(
      'ERR_CMD_UNKNOWN',
    );
  });
});

test.describe('XCP on Ethernet — byteOrder aynı baytları farklı adrese çözer', () => {
  test('SET_MTA adresi little-endian ve big-endian arasında DEĞİŞİR', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.locator('#decode-example').selectOption('set-mta-command');

    const littleEndianRaw = await fieldRow(page, 'address').getByTestId('decode-field-raw').innerText();

    await page.locator('#decode-option-byteOrder').selectOption('big-endian');
    const bigEndianRaw = await fieldRow(page, 'address').getByTestId('decode-field-raw').innerText();

    expect(bigEndianRaw).not.toBe(littleEndianRaw);
  });
});

test.describe('XCP on Ethernet — eksik XCP paketi', () => {
  test('yalnız 4 baytlık başlık decode-parse-error DEĞİL, kısmi çerçeve + decode-frame-error basar', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.locator('#decode-example').selectOption('empty-packet-header-only');

    // success:true ama frame.valid:false — bu yüzden decode-frame-error, decode-parse-error DEĞİL
    // (brief tuzağı: success:false olsaydı decode-parse-error beklerdik).
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
  });
});

test.describe('XCP on Ethernet sayfası — düzen', () => {
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
