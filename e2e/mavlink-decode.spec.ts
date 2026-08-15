import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 3d'nin gerçek tarayıcı turu — MAVLink.
 *
 * Kanıtladığı şey: brief-faz10-dalga3.md'nin dalga sonu kararı ("header tam
 * çözülür ama CRC dialect'e bağlı olduğu için doğrulanamaz, `status: partial`")
 * ekranda gerçekten görünüyor — v1/v2 header'ları alan alan çözülür, payload/
 * checksum ham + uyarılı gösterilir, imza varlığı doğrulanmadan raporlanır ve
 * `checksum-mismatch` hiçbir örnekte basılmaz. Bu protokolde alias sayfası YOK
 * (tek kanonik kayıt) — alias-devralma testi gerekmez.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/aerospace-uav/uav-telemetry/mavlink?tab=decode';

/** İlk örnek `v1-heartbeat`: spec'in kendi renklendirmesi (FE 09 2A 01 01 00 …). */
const V1_HEARTBEAT_HEX = 'FE 09 2A 01 01 00 01 02 03 04 05 06 07 08 09 AB CD';

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  await page.goto(CANONICAL_DECODE_PATH);
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

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test('decode sekmesi Kısmi rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('MAVLink');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'mavlink');
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('MAVLink 1 mutlu yol: header alan alan çözülür, payload/checksum ham + uyarılı', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(page.locator('#decode-hex')).toHaveValue(V1_HEARTBEAT_HEX);
  await expect(page.getByTestId('decode-byte-count')).toContainText('17');

  await expect(fieldRow(page, 'magic').getByTestId('decode-field-raw')).toHaveText('0xFE (254)');
  await expect(fieldRow(page, 'magic').getByTestId('decode-field-physical')).toHaveText('MAVLink 1');
  await expect(fieldRow(page, 'payload-length').getByTestId('decode-field-raw')).toHaveText('0x9 (9)');
  await expect(fieldRow(page, 'seq').getByTestId('decode-field-raw')).toHaveText('0x2A (42)');
  await expect(fieldRow(page, 'system-id').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  await expect(fieldRow(page, 'component-id').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  await expect(fieldRow(page, 'message-id').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');

  await expect(fieldRow(page, 'payload')).toHaveCount(1);
  await expect(fieldWarning(page, 'payload')).toContainText(
    tr['protocol.mavlink.warning.payloadNeedsDialect'],
  );
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-raw')).toHaveText(
    '0xCDAB (52651)',
  );
  await expect(fieldWarning(page, 'checksum')).toContainText(
    tr['protocol.mavlink.warning.crcNeedsDialect'],
  );

  await expect(fieldRow(page, 'signature')).toHaveCount(0);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('MAVLink 2 imzasız: Incompat/Compat Flags ve 24-bit MSGID doğru gösterilir', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('v2-gps-raw-int');

  await expect(fieldRow(page, 'magic').getByTestId('decode-field-physical')).toHaveText('MAVLink 2');
  await expect(fieldRow(page, 'incompat-flags').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
  // physicalValue yalnız signed durumunda yazılır (dosya başı) — boşken em-dash placeholder basar.
  await expect(fieldRow(page, 'incompat-flags').getByTestId('decode-field-physical')).toHaveText('—');
  await expect(fieldRow(page, 'compat-flags').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
  await expect(fieldRow(page, 'message-id').getByTestId('decode-field-raw')).toHaveText('0x18 (24)');
  await expect(fieldRow(page, 'signature')).toHaveCount(0);

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('MAVLink 2 imzalı: Incompat Flags Signed gösterir, imza ham + signatureNeedsKey', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('v2-signed');

  await expect(fieldRow(page, 'incompat-flags').getByTestId('decode-field-raw')).toHaveText('0x1 (1)');
  await expect(fieldRow(page, 'incompat-flags').getByTestId('decode-field-physical')).toHaveText(
    'Signed',
  );
  await expect(fieldRow(page, 'signature')).toHaveCount(1);
  await expect(fieldWarning(page, 'signature')).toContainText(
    tr['protocol.mavlink.warning.signatureNeedsKey'],
  );

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('24-bit MSGID sınırı: 0xFFFFFF flags/seq/sysid/compid ile çakışmadan çözülür', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('v2-large-message-id');

  await expect(fieldRow(page, 'seq').getByTestId('decode-field-raw')).toHaveText('0xFF (255)');
  await expect(fieldRow(page, 'system-id').getByTestId('decode-field-raw')).toHaveText('0xEE (238)');
  await expect(fieldRow(page, 'component-id').getByTestId('decode-field-raw')).toHaveText(
    '0xDD (221)',
  );
  await expect(fieldRow(page, 'message-id').getByTestId('decode-field-raw')).toHaveText(
    '0xFFFFFF (16777215)',
  );

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('eksik çerçeve truncated-frame basar ama header alanları yine görünür, checksum-mismatch YOK', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('v1-truncated');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
  await expect(frameError).not.toHaveAttribute('data-error-code', 'checksum-mismatch');
  await expect(fieldRow(page, 'seq')).toHaveCount(1);
  await expect(fieldRow(page, 'payload')).toHaveCount(0);
  await expect(fieldRow(page, 'checksum')).toHaveCount(0);

  await expectNoRawTranslationKeys(page);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
