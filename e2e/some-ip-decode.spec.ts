import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 14d'nin gerçek tarayıcı turu — SOME/IP + SOME/IP-SD.
 *
 * Kanıtladığı şeyler: kayıt Hazır rozetiyle açılıyor; başlık alanları (Service
 * ID, Method ID, Length, Client/Session ID, Message Type, Return Code) tabloda
 * görünüyor; bir REQUEST ile bir NOTIFICATION FARKLI Message Type fiziksel
 * değeri basıyor; payload HAM (rawValue yok, "—") ve "servis tanımı olmadan
 * çözülemez" uyarısını taşıyor; Message ID 0xFFFF8100 olan bir SD mesajı
 * TAMAMEN AYRI bir alan kümesi (SD Entry / SD Option) üretiyor ve payload satırı
 * hiç basılmıyor.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/automotive/automotive-ethernet/some-ip?tab=decode';

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

test.describe('SOME/IP katalog sayfası', () => {
  test('Hazır rozetiyle açılır ve decodeOptions HİÇ basmaz (kanal açılmadı)', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SOME/IP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'some-ip');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();

    // `decodeOptions` bilerek YOK: SD ayrımı ve yön/rol çerçeveden çıkar,
    // payload yapısı ise kanal açmakla çözülmez (12g RTP kararı).
    await expect(page.locator('[id^="decode-option-"]')).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });
});

test.describe('SOME/IP — başlık alanları', () => {
  test('varsayılan REQUEST örneğinde bütün başlık alanları tabloda görünür', async ({ page }) => {
    await openDecodePanel(page);

    await expect(fieldRow(page, 'service-id').getByTestId('decode-field-physical')).toHaveText(
      '0x1234',
    );
    await expect(fieldRow(page, 'method-id').getByTestId('decode-field-physical')).toHaveText(
      '0x0421',
    );
    await expect(fieldRow(page, 'client-id')).toBeVisible();
    await expect(fieldRow(page, 'session-id')).toBeVisible();
    await expect(fieldRow(page, 'protocol-version').getByTestId('decode-field-raw')).toContainText(
      '1',
    );
    await expect(fieldRow(page, 'interface-version')).toBeVisible();
    await expect(fieldRow(page, 'return-code').getByTestId('decode-field-physical')).toHaveText(
      'E_OK',
    );
  });

  test('Length TOPLAM mesaj boyunu fiziksel değer olarak basar (8 + Length)', async ({ page }) => {
    await openDecodePanel(page);

    // Ham 12, fiziksel 20 B — dosya başındaki üç kaynaklı sayım tabanı.
    await expect(fieldRow(page, 'length').getByTestId('decode-field-raw')).toContainText('12');
    await expect(fieldRow(page, 'length').getByTestId('decode-field-physical')).toContainText('20');
  });

  test('Method/Event sınıfı TÜRETİLİR ve tavsiye olduğunu söyleyen uyarıyı taşır', async ({
    page,
  }) => {
    await openDecodePanel(page);

    await expect(fieldRow(page, 'method-id-class').getByTestId('decode-field-physical')).toHaveText(
      'Method (0x0000–0x7FFF)',
    );
    await expect(fieldWarning(page, 'method-id-class')).toHaveCount(1);
  });
});

test.describe('SOME/IP — Message Type ayrımı çerçeveden çıkar', () => {
  test('REQUEST ile NOTIFICATION FARKLI Message Type fiziksel değeri basar', async ({ page }) => {
    await openDecodePanel(page);

    await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText(
      'REQUEST',
    );
    await expect(fieldRow(page, 'message-kind').getByTestId('decode-field-physical')).toHaveText(
      'Request',
    );

    await page.locator('#decode-example').selectOption('notification');

    await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText(
      'NOTIFICATION',
    );
    // Notification/Event ayrımı TÜRETİLİR (12f WebSocket `direction` sınıfı).
    await expect(fieldRow(page, 'message-kind').getByTestId('decode-field-physical')).toHaveText(
      'Notification / Event',
    );
    // AYNI alan, FARKLI Event ID aralığı → türetilen sınıf da döner.
    await expect(fieldRow(page, 'method-id-class').getByTestId('decode-field-physical')).toHaveText(
      'Event (0x8000–0xFFFF)',
    );
  });

  test('ERROR örneği Return Code tablosunu adlandırır', async ({ page }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('error');

    await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText(
      'ERROR',
    );
    await expect(fieldRow(page, 'return-code').getByTestId('decode-field-physical')).toHaveText(
      'E_UNKNOWN_METHOD',
    );
  });

  test('TP segmenti başlıktan sonra 4 baytlık TP başlığını açar', async ({ page }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('tp-segment');

    await expect(fieldRow(page, 'tp-offset').getByTestId('decode-field-physical')).toContainText(
      '16',
    );
    await expect(
      fieldRow(page, 'tp-more-segments').getByTestId('decode-field-physical'),
    ).toHaveText('More segments follow');
    // TP başlığı 4 bayt yer kapladığı için payload 20'den başlar.
    await expect(fieldRow(page, 'payload').locator('td').nth(1)).toHaveText('20');
  });
});

test.describe('SOME/IP — payload HAM kalır', () => {
  test('payload satırı sayısal değer BASMAZ ve servis tanımı uyarısı taşır', async ({ page }) => {
    await openDecodePanel(page);

    // rawValue BİLEREK yok → DecodePanel "—" basar.
    await expect(fieldRow(page, 'payload').getByTestId('decode-field-raw')).toHaveText('—');
    await expect(fieldRow(page, 'payload').getByTestId('decode-field-physical')).toHaveText('—');
    await expect(fieldWarning(page, 'payload')).toHaveCount(1);

    await expect(
      frameWarning(page, tr['protocol.someip.warning.payloadNeedsServiceDefinition']),
    ).toBeVisible();
  });

  test('payload’dan türetilmiş sahte alt alan basılmaz', async ({ page }) => {
    await openDecodePanel(page);
    // 16. bayttan sonrasını temsil eden TEK satır vardır: payload.
    await expect(page.locator('[data-testid="decode-field-row"][data-field-id="payload"]')).toHaveCount(
      1,
    );
  });
});

test.describe('SOME/IP-SD — ayrı alan kümesi', () => {
  test('Message ID 0xFFFF8100 SD girdilerini ve opsiyonlarını çözer, payload satırı BASMAZ', async ({
    page,
  }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('sd-offer-service');

    // SD başlığı: Flags 0xC0 → Reboot + Unicast.
    await expect(fieldRow(page, 'sd-flags-16').getByTestId('decode-field-physical')).toHaveText(
      'Reboot | Unicast',
    );
    await expect(fieldRow(page, 'sd-entries-length-20').getByTestId('decode-field-raw')).toContainText(
      '16',
    );

    // Ağaç YOK — girdi alan ADLARINA taşındı (12g RTCP emsali).
    await expect(fieldRow(page, 'sd-entry-type-24').getByTestId('decode-field-physical')).toHaveText(
      'Offer Service',
    );
    await expect(
      fieldRow(page, 'sd-entry-service-id-28').getByTestId('decode-field-physical'),
    ).toHaveText('0x1234');
    await expect(page.getByText('SD Entry 1 Service ID', { exact: true })).toBeVisible();

    // Opsiyon: Length 9 bildirir ama TOPLAM 12 bayttır (+3 tabanı).
    await expect(fieldRow(page, 'sd-option-type-46').getByTestId('decode-field-physical')).toHaveText(
      'IPv4 Endpoint',
    );
    await expect(
      fieldRow(page, 'sd-option-address-48').getByTestId('decode-field-physical'),
    ).toHaveText('192.168.1.10');
    await expect(
      fieldRow(page, 'sd-option-l4-protocol-53').getByTestId('decode-field-physical'),
    ).toHaveText('UDP');

    // SD çözüldüğü için ham payload satırı HİÇ basılmaz.
    await expect(fieldRow(page, 'payload')).toHaveCount(0);
    await expect(
      frameWarning(page, tr['protocol.someip.warning.payloadNeedsServiceDefinition']),
    ).toHaveCount(0);
  });

  test('opsiyonsuz Find Service girdisi ANY değerlerini basar', async ({ page }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('sd-find-service');

    await expect(fieldRow(page, 'sd-entry-type-24').getByTestId('decode-field-physical')).toHaveText(
      'Find Service',
    );
    await expect(
      fieldRow(page, 'sd-entry-instance-id-30').getByTestId('decode-field-physical'),
    ).toHaveText('ANY (0xFFFF)');
    await expect(fieldRow(page, 'sd-options-length-40').getByTestId('decode-field-raw')).toContainText(
      '0',
    );
    await expect(page.locator('[data-field-id^="sd-option-"]')).toHaveCount(0);
  });
});

test.describe('SOME/IP — eksik mesaj akış parçasıdır', () => {
  test('Length’in vaat ettiği bayt sayısı yoksa decode-parse-error basar', async ({ page }) => {
    await openDecodePanel(page);
    await page.locator('#decode-example').selectOption('truncated-message');

    // success:false → decode-parse-error (decode-frame-error DEĞİL; brief tuzağı).
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-parse-error-message')).toHaveText(
      tr['protocol.someip.error.messageIncomplete'],
    );
  });
});

test.describe('SOME/IP sayfası — düzen', () => {
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
