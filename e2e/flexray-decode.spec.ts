import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 14e'nin gerçek tarayıcı turu — FlexRay.
 *
 * Kanıtladığı şeyler: kayıt Hazır rozetiyle açılıyor; beş gösterge biti + Frame
 * ID + Payload Length + Cycle Count tabloda görünüyor; Payload Length'in SÖZCÜK
 * ham değeri ile BAYT fiziksel değeri AYRI AYRI basılıyor; Header CRC ile Frame
 * CRC AYRI SATIRLAR ve doğrulanma durumları BİRBİRİNDEN BAĞIMSIZ gösteriliyor;
 * `channel` seçimi Frame CRC'nin doğrulanmasını değiştirirken Header CRC'ye
 * DOKUNMUYOR; bozuk CRC'li çerçeve `decode-parse-error` DEĞİL alan seviyesinde
 * hata basıyor; eksik çerçeve ise gerçekten `decode-parse-error` basıyor.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/automotive/vehicle-network-protocols/flexray?tab=decode';

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

function fieldWarning(page: Page, fieldId: string): Locator {
  // Tuzak (12d/12e): alan uyarısı AYRI bir <tr>de basılır — fieldRow().getByTestId()
  // boş döner, kökten aramak şart.
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

function frameWarning(page: Page, text: string): Locator {
  // Birden çok çerçeve uyarısında getByTestId strict-mode ihlali verir.
  return page.locator('[data-testid="decode-frame-warning"]').filter({ hasText: text });
}

test.describe('FlexRay katalog sayfası', () => {
  test('Hazır rozetiyle açılır ve channel decodeOptions kanalını basar', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('FlexRay');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'flexray');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();

    // TEK kanal açıldı ve gerekçesi kaynak turunda kanıtlandı: Frame CRC init'i
    // kanala göre değişiyor, kanal ise çerçevenin içinde yok.
    await expect(page.locator('[id^="decode-option-"]')).toHaveCount(1);
    await expect(page.locator('#decode-option-channel')).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });
});

test.describe('FlexRay — başlık alanları', () => {
  test('beş gösterge biti, Frame ID ve Cycle Count tabloda görünür', async ({ page }) => {
    await openDecodePanel(page);

    // Varsayılan örnek: conformance codeword (kanal A), sync + startup çerçevesi.
    await expect(fieldRow(page, 'reserved-bit')).toBeVisible();
    await expect(
      fieldRow(page, 'payload-preamble-indicator').getByTestId('decode-field-physical'),
    ).toHaveText('No payload preamble');
    // NFI TERSTİR: 0 = null frame.
    await expect(
      fieldRow(page, 'null-frame-indicator').getByTestId('decode-field-physical'),
    ).toHaveText('Null frame (no payload data)');
    await expect(
      fieldRow(page, 'sync-frame-indicator').getByTestId('decode-field-physical'),
    ).toHaveText('Sync frame');
    await expect(
      fieldRow(page, 'startup-frame-indicator').getByTestId('decode-field-physical'),
    ).toHaveText('Startup frame');

    await expect(fieldRow(page, 'frame-id').getByTestId('decode-field-physical')).toHaveText(
      '0x002',
    );
    await expect(fieldRow(page, 'cycle-count').getByTestId('decode-field-raw')).toContainText('8');
  });

  test('bit ayrıntısı alan ADINDA taşınır (offset/length BAYT cinsinden)', async ({ page }) => {
    await openDecodePanel(page);
    await expect(page.getByText('Header Frame ID (bits 5-15)', { exact: true })).toBeVisible();
    await expect(page.getByText('Header Cycle Count (bits 34-39)', { exact: true })).toBeVisible();
    // Frame ID iki bayta yayılır ama offset 0 / length 2 olarak basılır.
    await expect(fieldRow(page, 'frame-id').locator('td').nth(1)).toHaveText('0');
    await expect(fieldRow(page, 'frame-id').locator('td').nth(2)).toHaveText('2');
  });

  test('Payload Length SÖZCÜK ham değerini ve BAYT fiziksel değerini AYRI basar', async ({
    page,
  }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('data-frame');

    // Bu ayrım, dalganın en olası sessiz hatasının görünür panzehiri.
    await expect(fieldRow(page, 'payload-length').getByTestId('decode-field-raw')).toContainText(
      '4',
    );
    await expect(
      fieldRow(page, 'payload-length').getByTestId('decode-field-physical'),
    ).toContainText('8');
    // Tuzak: /2-byte words/ kökten aranırsa katalog özetiyle de eşleşir ve
    // strict-mode ihlali verir — alan satırına kapsanır.
    await expect(fieldRow(page, 'payload-length')).toContainText('2-byte words');

    // Sözcük yerine bayt okunsaydı payload 4 bayt olurdu ve CRC kayardı.
    await expect(fieldRow(page, 'payload').locator('td').nth(2)).toHaveText('8');
  });
});

test.describe('FlexRay — iki CRC AYRI satır, AYRI doğrulama', () => {
  test('varsayılan örnekte iki CRC de AYRI satırda ve ikisi de Geçerli', async ({ page }) => {
    await openDecodePanel(page);

    await expect(fieldRow(page, 'header-crc')).toHaveCount(1);
    await expect(fieldRow(page, 'frame-crc')).toHaveCount(1);
    await expect(fieldRow(page, 'header-crc').getByTestId('decode-field-physical')).toHaveText(
      'Valid',
    );
    await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toHaveText(
      'Valid',
    );
    // Kullanılan kanal alan ADINDA görünür.
    await expect(page.getByText('Trailer Frame CRC-24 (Channel A)', { exact: true })).toBeVisible();
  });

  test('yalnız Frame CRC bozulunca Header CRC GEÇERLİ kalır — bağımsız doğrulama', async ({
    page,
  }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('bad-frame-crc');

    await expect(fieldRow(page, 'header-crc').getByTestId('decode-field-physical')).toHaveText(
      'Valid',
    );
    await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toContainText(
      'Invalid',
    );
    // Alan seviyesinde hata: uyarı AYRI <tr>de, kökten aranır.
    await expect(fieldWarning(page, 'frame-crc')).toHaveCount(1);
    await expect(fieldWarning(page, 'header-crc')).toHaveCount(0);
  });

  test('bozuk CRC decode-parse-error DEĞİL alan seviyesinde hata basar', async ({ page }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('bad-frame-crc');

    // success:true — kısmi çözüm gösterilir, başlık alanları hâlâ okunur.
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expect(fieldRow(page, 'frame-id').getByTestId('decode-field-physical')).toHaveText(
      '0x064',
    );
    // Çerçeve seviyesinde bir crc-mismatch hatası var.
    await expect(page.getByTestId('decode-frame-error')).not.toHaveCount(0);
  });

  test('başlık bozulunca İKİ CRC de geçersiz olur', async ({ page }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('bad-header-crc');

    await expect(fieldRow(page, 'header-crc').getByTestId('decode-field-physical')).toContainText(
      'Invalid',
    );
    await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toContainText(
      'Invalid',
    );
    await expect(fieldWarning(page, 'header-crc')).toHaveCount(1);
    await expect(fieldWarning(page, 'frame-crc')).toHaveCount(1);
  });
});

test.describe('FlexRay — channel kanalı Frame CRC doğrulamasını değiştirir', () => {
  test('kanal B codeword’ü A’da geçersiz, B’ye geçince geçerli olur', async ({ page }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('conformance-channel-b');

    // Varsayılan kanal A: AYNI baytlar geçersiz Frame CRC bildirir.
    await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toContainText(
      'Invalid',
    );
    // Header CRC kanaldan ETKİLENMEZ — iki CRC gerçekten ayrı.
    await expect(fieldRow(page, 'header-crc').getByTestId('decode-field-physical')).toHaveText(
      'Valid',
    );

    await page.locator('#decode-option-channel').selectOption('b');

    await expect(fieldRow(page, 'frame-crc').getByTestId('decode-field-physical')).toHaveText(
      'Valid',
    );
    await expect(page.getByText('Trailer Frame CRC-24 (Channel B)', { exact: true })).toBeVisible();
    await expect(fieldRow(page, 'header-crc').getByTestId('decode-field-physical')).toHaveText(
      'Valid',
    );
  });
});

test.describe('FlexRay — payload HAM kalır', () => {
  test('payload satırı sayısal değer BASMAZ ve tanım uyarısı taşır', async ({ page }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('data-frame');

    await expect(fieldRow(page, 'payload').getByTestId('decode-field-raw')).toHaveText('—');
    await expect(fieldRow(page, 'payload').getByTestId('decode-field-physical')).toHaveText('—');
    await expect(fieldWarning(page, 'payload')).not.toHaveCount(0);

    await expect(
      frameWarning(page, tr['protocol.flexray.warning.payloadNeedsDefinition']),
    ).toBeVisible();

    // Payload'dan türetilmiş sahte alt alan basılmaz: 5. bayttan sonrası TEK satır.
    await expect(fieldRow(page, 'payload')).toHaveCount(1);
  });

  test('payload preamble bildirilir ama AYRIŞTIRILMAZ', async ({ page }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('payload-preamble');

    await expect(
      fieldRow(page, 'payload-preamble-indicator').getByTestId('decode-field-physical'),
    ).toHaveText('Payload preamble present');
    await expect(fieldWarning(page, 'payload-preamble-indicator')).toHaveCount(1);
    // Preamble için AYRI alan YOK.
    await expect(page.locator('[data-field-id^="preamble-"]')).toHaveCount(0);
  });
});

test.describe('FlexRay — eksik çerçeve akış parçasıdır', () => {
  test('Payload Length’in vaat ettiği bayt yoksa decode-parse-error basar', async ({ page }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('truncated-frame');

    // success:false → decode-parse-error (decode-frame-error DEĞİL; brief tuzağı).
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-parse-error-message')).toHaveText(
      tr['protocol.flexray.error.payloadTruncated'],
    );
  });
});

test.describe('FlexRay sayfası — düzen', () => {
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
