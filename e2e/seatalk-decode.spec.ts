import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 16b'nin gerçek tarayıcı turu — SeaTalk 1.
 * Zarf, uzunluk formülü ve komut çözümü motor seviyesinde doğrulandı; bu dosya
 * motoru değil, **kapsam kararının EKRANDA görünür olduğunu** sınar:
 *   · rozet "Kısmi" ve özet neyin ÇÖZÜLMEDİĞİNİ açıkça yazıyor mu,
 *   · `commandBitNotInBytes` uyarısı HER çözümde görünüyor mu,
 *   · çift teyitli komutun tuşu adlandırılırken tek kaynaklı komutun payload'ı
 *     HAM kalıyor ve uyarı taşıyor mu,
 *   · tümleyen çifti gerçekten PASS/FAIL basıyor mu.
 * Desen `hdlc-based-marine-decode.spec.ts` (16a) ve `ads-b-decode.spec.ts`ten.
 */

const tr = translations.tr;
const DECODE_PATH = '/comm/marine-navigation/legacy-proprietary-marine/seatalk?tab=decode';

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });
  await page.goto(DECODE_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

function fieldName(page: Page, fieldId: string): Locator {
  return fieldRow(page, fieldId).getByTestId('decode-field-select');
}

/** Alan uyarısı AYRI bir `<tr>`dedir — satırın içinden değil KÖKTEN aranır. */
function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

/** Çerçeve uyarısı birden çok olduğu için strict-mode ihlaline düşmemek adına süzülür. */
function frameWarning(page: Page, text: string): Locator {
  return page.getByTestId('decode-frame-warning').filter({ hasText: text });
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

test('sayfa Kısmi rozetiyle açılır, özet neyin çözülmediğini AÇIKÇA yazar, konsola hata basmaz', async ({
  page,
}) => {
  const consoleErrors = await openDecodePanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('SeaTalk');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'seatalk');
  await expect(page.getByTestId('decode-plugin-name')).toHaveText('SeaTalk');
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  // Kaynaksız kayıt politikası: özet çözülenle çözülmeyeni AYRI AYRI sayar.
  const summary = page.locator('p', { hasText: 'RECOGNISED BUT NOT DECODED' }).first();
  await expect(summary).toContainText('DECODED');
  await expect(summary).toContainText('RECOGNISED BUT NOT DECODED');
  await expect(summary).toContainText('NOT AVAILABLE AT ALL');
  await expect(summary).toContainText('no checksum');

  // Varsayılan örnek Knauf'un gerçek yakalamasıdır ve ilk render'da girdide.
  await expect(page.locator('#decode-hex')).toHaveValue('86 11 05 FA');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('`86 11 05 FA`: komut "(assumed)" adlanır, tuş çift teyitli, tümleyen çifti PASS', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(fieldName(page, 'command')).toHaveText('Command (assumed)');
  await expect(fieldRow(page, 'command').getByTestId('decode-field-raw')).toContainText('0x86');
  await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText('Keystroke');
  // Komut biti çerçevede olmadığı için ALAN da uyarı taşır.
  await expect(fieldWarning(page, 'command')).toHaveText(tr['protocol.seatalk.field.commandAssumed']);

  // Attribute'ın yüksek nibble'ı VERİDİR — ayrı alan olarak görünür.
  await expect(fieldName(page, 'attribute-additional-byte-count')).toHaveText(
    'Attribute · Additional Byte Count (bit 0:3)',
  );
  await expect(fieldName(page, 'attribute-data-nibble')).toHaveText('Attribute · Data Nibble (bit 4:7)');

  await expect(fieldRow(page, 'keystroke-key').getByTestId('decode-field-physical')).toHaveText('-1');
  await expect(fieldWarning(page, 'keystroke-key')).toHaveCount(0);

  await expect(fieldRow(page, 'complement-3').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expect(fieldRow(page, 'complement-3')).toHaveAttribute('data-valid', 'true');

  // KOŞULSUZ iki uyarı: çerçevede olmayan komut biti ve olmayan checksum.
  await expect(frameWarning(page, tr['protocol.seatalk.warning.commandBitNotInBytes'])).toHaveCount(1);
  await expect(frameWarning(page, tr['protocol.seatalk.warning.noIntegrityCheckOnWire'])).toHaveCount(1);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('bozulmuş tümleyen çifti FAIL basar ve çerçeve hatası düşer', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'keystroke-complement-mismatch');

  await expect(fieldRow(page, 'complement-3').getByTestId('decode-field-physical')).toContainText('FAIL');
  await expect(fieldRow(page, 'complement-3')).toHaveAttribute('data-valid', 'false');
  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
    'data-error-code',
    'value-out-of-range',
  );
  // Komut biti uyarısı BURADA DA basılır — koşulsuzluğun ekrandaki kanıtı.
  await expect(frameWarning(page, tr['protocol.seatalk.warning.commandBitNotInBytes'])).toHaveCount(1);
});

test('tek kaynaklı komut TANINIR ama payload HAM kalır ve uyarılır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'unknown-meaning-a7');

  // Ad basılır — Knauf'un tablosu bir isim listesi olarak güvenilir.
  await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText(
    'Unknown Meaning (Raystar 120 GPS)',
  );
  // Payload ÇÖZÜLMEZ: tek ham alan + alan uyarısı + çerçeve uyarısı.
  await expect(fieldName(page, 'data')).toHaveText('Data (raw)');
  await expect(fieldWarning(page, 'data')).toHaveText(tr['protocol.seatalk.field.payloadNotDecoded']);
  await expect(
    frameWarning(page, tr['protocol.seatalk.warning.commandPayloadNeedsVendorMap']),
  ).toHaveCount(1);
  // Uydurma doğrulama yok: tümleyen alanı bu komutta HİÇ BASILMAZ.
  await expect(page.locator('[data-testid="decode-field-row"][data-field-id^="complement-"]')).toHaveCount(0);
});

test('`semanticDepth` seçeneği adlandırmayı gerçekten kapatır', async ({ page }) => {
  await openDecodePanel(page);

  await expect(page.locator('#decode-option-semanticDepth')).toBeVisible();
  await page.locator('#decode-option-semanticDepth').selectOption('raw');

  // Ham modda komut ADI basılmaz ve her veri baytı tek tek görünür.
  await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText('—');
  await expect(fieldRow(page, 'keystroke-key')).toHaveCount(0);
  await expect(fieldName(page, 'data-byte-2')).toHaveText('Data Byte 2');
  await expect(fieldRow(page, 'data-byte-3').getByTestId('decode-field-raw')).toContainText('0xFA');
  await expect(frameWarning(page, tr['protocol.seatalk.warning.rawModeNoNaming'])).toHaveCount(1);

  // Varsayılana dönünce çözüm geri gelir.
  await page.locator('#decode-option-semanticDepth').selectOption('knownCommands');
  await expect(fieldRow(page, 'keystroke-key').getByTestId('decode-field-physical')).toHaveText('-1');
});

test('9C örneği başlığı 180° ve dümeni −2° basar, birimler yalnız fiziksel değerde', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'compass-heading-rudder');

  await expect(fieldRow(page, 'compass-heading').getByTestId('decode-field-physical')).toContainText('180');
  await expect(fieldRow(page, 'rudder-position').getByTestId('decode-field-physical')).toContainText('-2');
  // Ham nibble alanı BİRİMSİZDİR.
  await expect(fieldRow(page, 'attribute-data-nibble').getByTestId('decode-field-physical')).toHaveText('—');
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
