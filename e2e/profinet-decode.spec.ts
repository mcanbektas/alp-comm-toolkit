import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 13e'nin gerçek tarayıcı turu — PROFINET.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/industrial-
 * ethernet/profinet) Hazır rozetiyle açıldığı; DCP bloklarının ÇİFT hizalama
 * dolgusunun gerçekten tüketildiği (dolgu atlansa sonraki blok bir bayt
 * kayardı — ofset sütunu bunu tarayıcıda gösteriyor); döngüsel çerçevede APDU
 * Status'un ÇERÇEVE SONUNDAN geri sayılarak bulunduğu; I/O verisinin sahte bir
 * kırılım olmadan ham kaldığı ve nedeninin alan uyarısıyla söylendiği.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/industrial-ethernet/profinet?tab=decode';

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

/**
 * Ofset sütununun kendi testid'i yok; satırdaki hücre sırası
 * ad(0) · ofset(1) · uzunluk(2) · ham(3) · fiziksel(4) · geçerlilik(5).
 * Bu turun ASIL kanıtı ofset olduğu için hücre doğrudan okunuyor.
 */
function fieldOffsetCell(page: Page, fieldId: string): Locator {
  return fieldRow(page, fieldId).locator('td').nth(1);
}

/**
 * Alan uyarısı satırın KENDİ `<tr>`si içinde değil, AYRI bir `<tr>`dedir —
 * bu yüzden kökten aranır (önceki dalgalarda iki kez ödenmiş tuzak).
 */
function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.getByLabel(tr['decode.example.label']).selectOption(exampleId);
}

test.describe('PROFINET', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PROFINET');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'profinet');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('DCP: tek uzunluklu bloğun hizalama dolgusu tüketilir, sonraki blok KAYMAZ', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'dcp-identify-response');

    // 14 Ethernet + 2 FrameID + 10 DCP başlığı = 26 → blok 0.
    await expect(fieldOffsetCell(page, 'dcp-block-0-option')).toHaveText('26');
    // DCPBlockLength 11 (TEK) → 4 + 11 = 15 → dolgu 41'de.
    await expect(fieldRow(page, 'dcp-block-0-length').getByTestId('decode-field-raw')).toHaveText(
      '0xB (11)',
    );
    await expect(fieldOffsetCell(page, 'dcp-block-0-padding')).toHaveText('41');
    // Dolgu atlansaydı blok 1 burada 41'de başlar ve Option 0x00 okunurdu.
    await expect(fieldOffsetCell(page, 'dcp-block-1-option')).toHaveText('42');
    await expect(
      fieldRow(page, 'dcp-block-1-option').getByTestId('decode-field-physical'),
    ).toHaveText('Device properties');
    await expect(fieldRow(page, 'dcp-block-1-text').getByTestId('decode-field-raw')).toHaveText(
      'conveyor-io-01',
    );
    // Hizalama korunduğu için üçüncü blok da doğru yerde: IP parametresi çözülür.
    await expect(fieldRow(page, 'dcp-block-2-ip-address').getByTestId('decode-field-raw')).toHaveText(
      '192.168.10.25',
    );
  });

  test('DCP: iki tek uzunluklu blok üst üste geldiğinde de hizalama korunur', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'dcp-set-response-padding');

    await expect(fieldOffsetCell(page, 'dcp-block-0-padding')).toHaveText('33');
    await expect(fieldOffsetCell(page, 'dcp-block-1-option')).toHaveText('34');
    await expect(
      fieldRow(page, 'dcp-block-1-block-error').getByTestId('decode-field-physical'),
    ).toHaveText('Suboption not set');
  });

  test('DCP Get isteğinde bloklar DEĞİL uzunluksuz seçiciler okunur', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'dcp-get-request-selectors');

    await expect(fieldRow(page, 'dcp-block-0-length')).toHaveCount(0);
    await expect(fieldOffsetCell(page, 'dcp-block-0-option')).toHaveText('26');
    await expect(fieldOffsetCell(page, 'dcp-block-1-option')).toHaveText('28');
    await expect(fieldOffsetCell(page, 'dcp-block-2-option')).toHaveText('30');
  });

  test('döngüsel çerçevede APDU Status ÇERÇEVE SONUNDAN geri sayılarak bulunur', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'rt-cyclic-io');

    // Çerçeve 60 bayt; kuyruk son 4 bayttır → 56 / 58 / 59.
    await expect(fieldOffsetCell(page, 'cycle-counter')).toHaveText('56');
    await expect(fieldOffsetCell(page, 'data-status')).toHaveText('58');
    await expect(fieldOffsetCell(page, 'transfer-status')).toHaveText('59');
    await expect(fieldRow(page, 'cycle-counter').getByTestId('decode-field-raw')).toHaveText(
      '0x1234 (4660)',
    );
    // I/O verisi FrameID ile kuyruk arasındaki HER ŞEYdir: 16'dan 40 bayt.
    await expect(fieldOffsetCell(page, 'io-data')).toHaveText('16');
    await expect(fieldRow(page, 'io-data').locator('td').nth(2)).toHaveText('40');
  });

  test('I/O verisi sahte alanlara bölünmez; nedeni alan uyarısıyla söylenir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'rt-cyclic-io');

    await expect(fieldWarning(page, 'io-data')).toHaveCount(1);
    await expect(fieldWarning(page, 'io-data')).toContainText(
      tr['protocol.profinet.warning.ioDataNeedsGsdml'],
    );
    // Uydurma kırılım yok: I/O bölgesinde tek bir satır vardır.
    await expect(fieldRow(page, 'io-data')).toHaveCount(1);
    await expect(fieldWarning(page, 'cycle-counter')).toHaveCount(1);
  });

  test('DataStatus sekiz biti ayrı satırlara açılır ve okunabilir ad taşır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'rt-cyclic-io');

    await expect(
      fieldRow(page, 'data-status-state').getByTestId('decode-field-physical'),
    ).toHaveText('Primary');
    await expect(
      fieldRow(page, 'data-status-data-valid').getByTestId('decode-field-physical'),
    ).toHaveText('Valid');
    await expect(
      fieldRow(page, 'data-status-provider-state').getByTestId('decode-field-physical'),
    ).toHaveText('Run');
    await expect(
      fieldRow(page, 'data-status-station-problem').getByTestId('decode-field-physical'),
    ).toHaveText('Normal operation');
  });

  test('durmuş sağlayıcı ve TransferStatus≠0 uyarı olarak görünür, hata olarak DEĞİL', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'rt-cyclic-provider-stopped');

    await expect(
      fieldRow(page, 'data-status-provider-state').getByTestId('decode-field-physical'),
    ).toHaveText('Stop');
    await expect(
      fieldRow(page, 'transfer-status').getByTestId('decode-field-physical'),
    ).toHaveText('Ignore this frame');
    // Birden çok çerçeve uyarısı var → strict-mode ihlaline düşmemek için filtre.
    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.profinet.warning.transferStatusNotOk'] }),
    ).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('alarm çerçevesi RTA başlığı + AlarmNotification bloğuyla çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'alarm-low-diagnosis');

    await expect(fieldRow(page, 'frame-id').getByTestId('decode-field-physical')).toHaveText(
      'Acyclic PN-IO Alarm, low priority',
    );
    await expect(fieldRow(page, 'alarm-pdu-type').getByTestId('decode-field-physical')).toHaveText(
      'Data-RTA-PDU',
    );
    await expect(fieldRow(page, 'alarm-block-type').getByTestId('decode-field-physical')).toHaveText(
      'Alarm Notification Low',
    );
    await expect(fieldRow(page, 'alarm-type').getByTestId('decode-field-physical')).toHaveText(
      'Diagnosis',
    );
    // Sabit başlık 16'da başlar, 12 bayt sonra blok: 28.
    await expect(fieldOffsetCell(page, 'alarm-dst-endpoint')).toHaveText('16');
    await expect(fieldOffsetCell(page, 'alarm-block-type')).toHaveText('28');
    await expect(
      fieldRow(page, 'alarm-specifier-channel').getByTestId('decode-field-physical'),
    ).toHaveText('Yes');
  });

  test('kapsam dışı PTCP gövdesi ham gösterilir ve nedeni yazılır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'ptcp-announce');

    await expect(fieldRow(page, 'frame-id').getByTestId('decode-field-physical')).toContainText(
      'PTCP Announce',
    );
    await expect(fieldWarning(page, 'payload')).toContainText(
      tr['protocol.profinet.warning.ptcpBodyNotDecoded'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('yanlış EtherType: MAC alanları çözülür ama FrameID’ye DOKUNULMAZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'ethertype-not-profinet');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'start-delimiter-not-found');
    await expect(fieldRow(page, 'destination-mac')).toHaveCount(1);
    await expect(fieldRow(page, 'frame-id')).toHaveCount(0);
    await expect(fieldRow(page, 'cycle-counter')).toHaveCount(0);
  });

  test('kesik DCP bölgesi: kısmi çözüm korunur, çerçeve length-mismatch ile işaretlenir', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'dcp-block-truncated');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'length-mismatch');
    await expect(fieldRow(page, 'dcp-block-0-text').getByTestId('decode-field-raw')).toHaveText(
      'ab',
    );
  });

  test('Ethernet başlığından kısa girdi decode-parse-error kartı basar', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.hexInput.label']).fill('00 11 22 33 44 55 66 77');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, DECODE_PATH);
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
