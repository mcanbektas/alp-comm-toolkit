import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 7b'nin gerçek tarayıcı turu — LoRaWAN.
 *
 * Kanıtladığı şey: brief-faz10-dalga7.md'nin dalga sonu kararı ("MIC hiçbir
 * zaman doğrulanmaz — mavlink crcNeedsDialect emsali, PASS/FAIL asla
 * basılmaz", karar 8 "şifreli içerik ham+işaret") ekranda gerçekten görünüyor
 * — Join-Request açık metin çözülür, Join-Accept/FRMPayload/FOpts ham+uyarılı
 * gösterilir, `status: partial` rozeti (MIC hiç doğrulanamadığı için) ekranda
 * çıkar. Bu protokolde alias sayfası YOK (tek kanonik kayıt).
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/wireless-iot/lora-lpwan/lorawan?tab=decode';

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

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

test('decode sekmesi Kısmi rozetiyle açılır, konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('LoRaWAN');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'lorawan');
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('Join-Request: JoinEUI/DevEUI/DevNonce açık metin çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'join-request');

  await expect(fieldRow(page, 'ftype').getByTestId('decode-field-physical')).toHaveText('Join-Request');
  await expect(fieldRow(page, 'join-eui').getByTestId('decode-field-raw')).toHaveText(
    '08:07:06:05:04:03:02:01',
  );
  await expect(fieldRow(page, 'dev-nonce').getByTestId('decode-field-raw')).toHaveText('0x2A (42)');
  await expect(fieldWarning(page, 'mic')).toContainText(tr['protocol.lorawan.warning.micNeedsSessionKeys']);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('Join-Accept: MHDR sonrası tek ham + şifreli blok gösterilir', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'join-accept');

  await expect(fieldRow(page, 'ftype').getByTestId('decode-field-physical')).toHaveText('Join-Accept');
  await expect(fieldRow(page, 'join-accept-payload')).toBeVisible();
  await expect(fieldWarning(page, 'join-accept-payload')).toContainText(
    tr['protocol.lorawan.warning.joinAcceptEncrypted'],
  );
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('Unconfirmed Data Up: FHDR alan alan çözülür, MIC asla PASS/FAIL basmaz', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'unconfirmed-data-up');

  await expect(fieldRow(page, 'dev-addr').getByTestId('decode-field-raw')).toHaveText('0x2B1A0126');
  await expect(fieldRow(page, 'frm-payload')).toBeVisible();
  await expect(fieldWarning(page, 'frm-payload')).toContainText(
    tr['protocol.lorawan.warning.frmPayloadEncrypted'],
  );
  // MIC hiçbir zaman doğrulanmaz: Fiziksel Değer sütunu boş (—) kalır, PASS/FAIL YAZILMAZ.
  await expect(fieldRow(page, 'mic').getByTestId('decode-field-physical')).toHaveText('—');
  await expectNoRawTranslationKeys(page);
});

/**
 * Bu iki test dalga 8'de (`ea02949`, FOpts MAC komut borcu) DEĞİŞEN davranışı
 * sınar. Öncesinde tek bir ham `fopts` alanı + "çözülmedi" uyarısı basılıyordu;
 * artık zincir CID CID çözülüyor ve ham kalan YALNIZ bilinmeyen CID'den sonra
 * çıkıyor. Eski test dalga 8'de güncellenmemiş, kırmızı kalmıştı — `e2e/`
 * `tsconfig.json`ın `include`ında olmadığı için ölü çeviri anahtarı
 * (`warning.foptsNotDecoded`) derlemede de yakalanmamıştı.
 */
test('Confirmed Data Down + FOpts: downlink FCtrl yorumlanır, MAC komutu çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'confirmed-data-down-with-fopts');

  await expect(fieldRow(page, 'f-pending')).toBeVisible();
  // Sayısal ham değerler panelde `0x<hex> (<ondalık>)` biçiminde basılır.
  await expect(fieldRow(page, 'fopts-len').getByTestId('decode-field-raw')).toHaveText('0x2 (2)');
  // FOpts = 04 03 → DutyCycleReq(CID 0x04) + MaxDCycle=3.
  await expect(fieldRow(page, 'mac-command-1')).toContainText('DutyCycleReq');
  await expect(fieldRow(page, 'mac-command-1-max-dcycle').getByTestId('decode-field-raw')).toHaveText('0x3 (3)');
  await expectNoRawTranslationKeys(page);
});

test('Bilinmeyen CID: zincir durur, kalan FOpts ham+uyarılı kalır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'mac-commands-unknown-cid');

  // Bilinmeyen CID'in gövde uzunluğu bilinmez — zincir orada durmalı, kalanı
  // uydurulmuş bir şemayla çözmeye çalışmamalı.
  await expect(fieldRow(page, 'mac-command-1')).toContainText('Unknown CID');
  await expect(fieldWarning(page, 'mac-command-1')).toContainText(
    tr['protocol.lorawan.warning.unknownMacCommandCid'],
  );
  await expect(fieldWarning(page, 'mac-command-1-remainder')).toContainText(
    tr['protocol.lorawan.warning.foptsRemainderNotDecoded'],
  );
  await expectNoRawTranslationKeys(page);
});

test('FPort=0: MAC komutu olarak işaretlenir, uygulama verisi denmez', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'mac-command-only');

  await expect(fieldRow(page, 'f-port').getByTestId('decode-field-physical')).toContainText('MAC commands only');
});

test('eksik FHDR truncated-frame hatası basar', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'truncated-fhdr');

  await expect(page.getByTestId('decode-frame-error')).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute('data-error-code', 'truncated-frame');
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
