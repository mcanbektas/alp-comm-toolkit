import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 9 dalga 3'ün gerçek tarayıcı turu — J1939.
 *
 * Bu dosyanın kanıtladığı iki şey var:
 *   1. Spec §43'ün DOĞRULANMIŞ fixture'ı (0x18F00401 → Priority 6, PGN 61444,
 *      Source Address 1) ekranda gerçekten o üç değeri basıyor.
 *   2. `marine-navigation/marine-machinery/marine-j1939` alias sayfası aynı
 *      motoru ve "Hazır" rozetini kanonik kayıttan devralıyor — alias zinciri
 *      dalga 3'te de çalışıyor.
 */

const tr = translations.tr;

/** Kanonik kayıt: motoru burada tanımlı. */
const CANONICAL_DECODE_PATH = '/comm/automotive/vehicle-network-protocols/j1939?tab=decode';
/** Alias kayıt: kendi `pluginId`si YOK, motoru kanonik kayıttan devralır. */
const ALIAS_DECODE_PATH = '/comm/marine-navigation/marine-machinery/marine-j1939?tab=decode';

/** Spec §43 fixture'ı, SocketCAN düzeninde: 0x18F00401 | EFF → 01 04 F0 98. */
const FIXTURE_HEX = '01 04 F0 98 08 00 00 00 FF FF FF 68 13 FF FF FF';

async function openPage(page: Page, path: string): Promise<string[]> {
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
  return consoleErrors;
}

async function openDecodePanel(page: Page, path: string): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
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

test('decode sekmesi gerçek panelle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('J1939');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'j1939');
  await expect(page.getByTestId('decode-loading')).toHaveCount(0);
  await expect(page.getByTestId('decode-load-error')).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('spec §43 fixture’ı ekranda Priority 6, PGN 61444, Source Address 1 basar', async ({
  page,
}) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await expect(page.locator('#decode-hex')).toHaveValue(FIXTURE_HEX);
  await expect(page.getByTestId('decode-byte-count')).toContainText('16');

  // can-id, priority, reserved, data-page, pdu-format, pdu-specific, pgn,
  // source-address, dlc, data.
  await expect(page.getByTestId('decode-field-row')).toHaveCount(10);

  // Spec'in beklediği üç değer — bu turun asıl kanıtı.
  await expect(fieldRow(page, 'priority').getByTestId('decode-field-raw')).toHaveText('0x6 (6)');
  await expect(fieldRow(page, 'pgn').getByTestId('decode-field-raw')).toHaveText('0xF004 (61444)');
  await expect(fieldRow(page, 'source-address').getByTestId('decode-field-raw')).toHaveText(
    '0x1 (1)',
  );

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('PDU Format alanı PDU1/PDU2 sonucunu kendisi söyler', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  // PF = 0xF0 = 240 ≥ 240 → PDU2, PS group extension olarak PGN'e girer.
  await expect(fieldRow(page, 'pdu-format').getByTestId('decode-field-raw')).toHaveText(
    '0xF0 (240)',
  );
  await expect(fieldRow(page, 'pdu-format').getByTestId('decode-field-physical')).toHaveText(
    'PDU2',
  );

  await page.getByLabel(tr['decode.example.label']).selectOption('pdu1-destination-specific');

  // PF = 0xEF = 239 < 240 → PDU1: PS HEDEF ADRESTİR ve PGN'den düşülür.
  await expect(fieldRow(page, 'pdu-format').getByTestId('decode-field-physical')).toHaveText(
    'PDU1',
  );
  await expect(fieldRow(page, 'pgn').getByTestId('decode-field-raw')).toHaveText('0xEF00 (61184)');
  await expect(fieldRow(page, 'pdu-specific').getByTestId('decode-field-raw')).toHaveText(
    '0x2A (42)',
  );
});

test('SPN çözümünün lisanslı veritabanı gerektirdiği uyarıyla söylenir', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  // Spec: J1939DA lisanslıdır; uydurma alan adı basmak yerine sebebi söylenir.
  await expect(page.getByTestId('decode-frame-warning')).toContainText(
    tr['protocol.j1939.warning.spnNeedsDatabase'],
  );
  await expectNoRawTranslationKeys(page);
});

test('yapısal PGN tanınır ve adlandırılır', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('address-claimed');

  await expect(fieldRow(page, 'pgn').getByTestId('decode-field-raw')).toHaveText('0xEE00 (60928)');
  await expect(fieldRow(page, 'pgn').getByTestId('decode-field-physical')).toHaveText(
    'Address Claimed',
  );
  await expect(fieldRow(page, 'pdu-specific').getByTestId('decode-field-physical')).toHaveText(
    'Global',
  );
});

test('11-bit çerçeve hata basar ama çerçeve yine alan alan gösterilir', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  await page.getByLabel(tr['decode.example.label']).selectOption('base-frame-rejected');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');

  // J1939 alanları üretilmez — 11 bitten PGN çıkarılamaz.
  await expect(fieldRow(page, 'pgn')).toHaveCount(0);
  // Ama CAN ID, DLC ve veri yine görünür (spec §47).
  await expect(fieldRow(page, 'can-id').getByTestId('decode-field-raw')).toHaveText('0x123 (291)');
  await expect(fieldRow(page, 'data')).toHaveCount(1);
  await expectNoRawTranslationKeys(page);
});

test('alan seçimi bayt görüntüleyicideki bölgeyi vurgular', async ({ page }) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  // Source Address kendi baytına (0) sahip: identifier'ı kapsayan `can-id`
  // bölgesinin üstüne yaprak olarak yazılır ve görünür kalır.
  const sourceRegion = page.locator('[data-region-id="source-address"]').first();
  await expect(sourceRegion).toHaveAttribute('data-selected', 'false');

  await fieldRow(page, 'source-address').getByTestId('decode-field-select').click();

  await expect(sourceRegion).toHaveAttribute('data-selected', 'true');
  await expect(fieldRow(page, 'source-address')).toHaveAttribute('data-selected', 'true');

  await sourceRegion.click();
  await expect(sourceRegion).toHaveAttribute('data-selected', 'false');
});

test('türetilmiş PGN alanının bayt bölgesi YOKTUR — atomik alanlar onu tamamen örter', async ({
  page,
}) => {
  await openDecodePanel(page, CANONICAL_DECODE_PATH);

  // PGN, PS + PF + DP baytlarından TÜRETİLİR; kendi baytı yoktur. Bölge
  // adaptörünün "kapsayıcı önce, yaprak sonra" değişmezi gereği o üç baytı
  // atomik alanlar kaplar ve kapsayıcıya görünür bayt kalmaz. Bu bilinçli:
  // kullanıcı baytlarda gerçekte NE OLDUĞUNU görür, türetilmiş değeri tabloda
  // okur. Bekçi burada — PGN'e bölge verilirse PF/PS/DP ekrandan kaybolur.
  await expect(page.locator('[data-region-id="pgn"]')).toHaveCount(0);
  await expect(page.locator('[data-region-id="pdu-format"]')).toHaveCount(1);
  await expect(page.locator('[data-region-id="pdu-specific"]')).toHaveCount(1);

  // Tabloda ise PGN satırı elbette var ve değerini basıyor.
  await expect(fieldRow(page, 'pgn').getByTestId('decode-field-raw')).toHaveText('0xF004 (61444)');
});

test('marine alias sayfası aynı motoru ve Hazır rozetini devralır', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page, ALIAS_DECODE_PATH);

  // Alias kaydın kendi `pluginId`si yok; motor kanonik kayda inilerek bulunur.
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'j1939');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: tr['protocol.canonical'] })).toBeVisible();

  // Panel kanonik sayfadakiyle AYNI.
  await expect(page.locator('#decode-hex')).toHaveValue(FIXTURE_HEX);
  await expect(fieldRow(page, 'pgn').getByTestId('decode-field-raw')).toHaveText('0xF004 (61444)');

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page, CANONICAL_DECODE_PATH);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(
    0,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(
    0,
  );
});
