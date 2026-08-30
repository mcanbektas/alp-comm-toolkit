import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 5d'nin gerçek tarayıcı turu — EtherCAT.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/
 * industrial-ethernet/ethercat) Hazır rozetiyle açıldığı; Ethernet başlığının
 * EtherCAT sayfasında da alan olarak çözüldüğü (karar 5 — bu bir katman zinciri
 * değil, çerçevenin kendisi); adres alanının komuta göre logical/ADP+ADO diye
 * BÖLÜNDÜĞÜ; Working Counter'ın veriden SONRA geldiği ve hakkında asla
 * doğru/yanlış iddiası basılmadığı; More bitiyle zincirin yürüdüğü; Type≠1,
 * yanlış EtherType ve kesik çerçeve yollarının ekranda gerçekten çıktığı.
 *
 * EtherCAT'in alias sayfası YOK (katalog "Katalog yolları" tablosu) — bu yüzden
 * alias devralma testi burada yok.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/industrial-automation/industrial-ethernet/ethercat?tab=decode';

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

/** Bu motor bir çerçevede birden çok frame-uyarısı basar (process data + WKC +
 * duruma özel olan) — tek tek aranır, `toContainText` strict-mode'a takılır. */
function frameWarning(page: Page, text: string): Locator {
  return page.getByTestId('decode-frame-warning').filter({ hasText: text });
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

test.describe('EtherCAT', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('EtherCAT');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ethercat');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('LRW örneği Ethernet başlığını, tek logical adresi ve dolguyu basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('lrw-cyclic-process-data');

    await expect(fieldRow(page, 'destination-mac').getByTestId('decode-field-physical')).toHaveText(
      'Broadcast',
    );
    await expect(fieldRow(page, 'ethertype').getByTestId('decode-field-physical')).toHaveText(
      'EtherCAT',
    );
    await expect(fieldRow(page, 'ecat-type').getByTestId('decode-field-physical')).toHaveText(
      'EtherCAT commands',
    );
    await expect(
      fieldRow(page, 'datagram-0-command').getByTestId('decode-field-physical'),
    ).toHaveText('LRW — Logical ReadWrite');
    await expect(fieldRow(page, 'datagram-0-logical-address')).toHaveCount(1);
    await expect(fieldRow(page, 'datagram-0-adp')).toHaveCount(0);
    await expect(fieldRow(page, 'padding')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('FPRD örneği adresi ADP + ADO olarak ikiye böler', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('fprd-configured-address-read');

    await expect(
      fieldRow(page, 'datagram-0-command').getByTestId('decode-field-physical'),
    ).toHaveText('FPRD — Configured Address Physical Read');
    await expect(fieldRow(page, 'datagram-0-adp')).toHaveCount(1);
    await expect(fieldRow(page, 'datagram-0-ado')).toHaveCount(1);
    await expect(fieldRow(page, 'datagram-0-logical-address')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('BRD örneği Working Counter’ı gösterir ama doğrulama iddiası basmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('brd-startup-scan');

    await expect(
      fieldRow(page, 'datagram-0-working-counter').getByTestId('decode-field-raw'),
    ).toContainText('3');
    await expect(
      frameWarning(page, tr['protocol.ethercat.warning.workingCounterNotVerifiable']),
    ).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('zincir örneği iki datagramı ve iki Working Counter’ı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('multi-datagram-chain');

    await expect(fieldRow(page, 'datagram-0-more').getByTestId('decode-field-physical')).toHaveText(
      'More datagrams follow',
    );
    await expect(
      fieldRow(page, 'datagram-1-command').getByTestId('decode-field-physical'),
    ).toHaveText('LWR — Logical Write');
    await expect(fieldRow(page, 'datagram-1-working-counter')).toHaveCount(1);
    await expect(fieldRow(page, 'datagram-2-command')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('teyit edilmemiş komut örneği adı vermez, adresi ham bırakır', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unknown-command');

    await expect(fieldRow(page, 'datagram-0-address')).toHaveCount(1);
    await expect(fieldRow(page, 'datagram-0-adp')).toHaveCount(0);
    await expect(frameWarning(page, tr['protocol.ethercat.warning.unknownCommand'])).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Type ≠ 1 örneği gövdeyi ham bırakır', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('non-command-type');

    await expect(fieldRow(page, 'ecat-type').getByTestId('decode-field-physical')).toHaveText(
      'Mailbox',
    );
    await expect(fieldRow(page, 'ecat-payload')).toHaveCount(1);
    await expect(fieldRow(page, 'datagram-0-command')).toHaveCount(0);
    await expect(frameWarning(page, tr['protocol.ethercat.warning.nonCommandType'])).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('yanlış EtherType örneği hata kartı basar ve gövdeye dokunmaz', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('ethertype-not-ethercat');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveAttribute('data-error-code', 'start-delimiter-not-found');
    await expect(fieldRow(page, 'ecat-length')).toHaveCount(0);
    await expect(fieldRow(page, 'payload')).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('kesik datagram bölgesi örneği truncated-frame basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('datagram-truncated');

    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('çok kısa çerçeve örneği parse hatası kartı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('frame-too-short');

    const parseError = page.getByTestId('decode-parse-error');
    await expect(parseError).toBeVisible();
    await expect(parseError).toHaveAttribute('data-error-code', 'truncated-frame');
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('EtherCAT');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('frame-too-short');
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('ethernet-ii sayfası 0x88A4’ü adlandırır ama çözmez', async ({ page }) => {
    // Karar 5'in ikinci yarısı: zincir KURULMAZ, yalnız yönlendirilir.
    await openDecodePanel(page, '/comm/network-ethernet/data-link/ethernet-ii?tab=decode');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ethernet-ii');
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('multi-datagram-chain');
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
