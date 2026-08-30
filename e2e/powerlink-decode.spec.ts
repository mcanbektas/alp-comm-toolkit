import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 13f'nin gerçek tarayıcı turu — POWERLINK.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/industrial-
 * ethernet/powerlink) Hazır rozetiyle açıldığı; MessageType dispatch'inin
 * SoC/PReq/PRes/SoA/ASnd'i doğru gövdeye yönlendirdiği; PDO Size alanının
 * ÇERÇEVEDE YAZAN 16-bit bir alan olduğu (CANopen'ın ≤8 baytlık CAN DLC
 * sınırının burada GEÇMEDİĞİ — paylaşım kararının üçüncü kanıtı); IdentResponse
 * IP alanlarının iki kaynağın bayt sırasında ÇAKIŞMASI yüzünden ham kaldığı;
 * SDO via ASnd'in Sequence+Command Layer'ının ve Abort Code'un ekranda gerçekten
 * çözüldüğü.
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır.
 * - `success:false` → `decode-parse-error` kartı (`decode-frame-error` DEĞİL).
 * - `decode-field-raw` sayıyı `0x… (…)` biçiminde basar.
 * - `unit` yalnız `physicalValue` DOLUYSA değere yapıştırılır.
 * - Birden çok çerçeve uyarısında `decode-frame-warning` strict-mode'a takılır.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/industrial-ethernet/powerlink?tab=decode';

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

function fieldOffsetCell(page: Page, fieldId: string): Locator {
  return fieldRow(page, fieldId).locator('td').nth(1);
}

function fieldLengthCell(page: Page, fieldId: string): Locator {
  return fieldRow(page, fieldId).locator('td').nth(2);
}

/** Alan uyarısı kökten aranır — `fieldRow(...)`un İÇİNDE DEĞİL, ayrı bir `<tr>`de. */
function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.getByLabel(tr['decode.example.label']).selectOption(exampleId);
}

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const text of await page.getByTestId(testId).allTextContents()) {
      expect(text.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test.describe('POWERLINK', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('POWERLINK');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'powerlink');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('SoC: NetTime ve 64-bit RelativeTime alanlarını gösterir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'soc-cycle-start');

    await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText(
      'Start of Cycle (SoC)',
    );
    await expect(
      fieldRow(page, 'soc-nettime-seconds-20').getByTestId('decode-field-physical'),
    ).toHaveText('1700000000 s');
    await expect(
      fieldRow(page, 'soc-nettime-nanoseconds-24').getByTestId('decode-field-physical'),
    ).toHaveText('250000 ns');
    await expect(
      fieldRow(page, 'soc-relative-time-28').getByTestId('decode-field-physical'),
    ).toHaveText('4000000 µs');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('PReq: RD bayrağı, PDOVersion ve 16-bit Size alanı ofset 22de çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'preq-poll-request');

    await expect(fieldRow(page, 'pdo-flag-rd-18').getByTestId('decode-field-physical')).toHaveText(
      'Data valid',
    );
    await expect(fieldRow(page, 'pdo-version-20').getByTestId('decode-field-physical')).toHaveText(
      '1.0',
    );
    await expect(fieldOffsetCell(page, 'pdo-size-22')).toHaveText('22');
    await expect(fieldRow(page, 'pdo-size-22').getByTestId('decode-field-raw')).toHaveText(
      '0x24 (36)',
    );
    await expect(fieldWarning(page, 'pdo-payload-24')).toContainText(
      tr['protocol.powerlink.warning.pdoPayloadNeedsMapping'],
    );
  });

  test('PRes: büyük PDO yükü CANopenin ≤8 baytlık CAN DLC sınırını AŞAR (16-bit Size)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'pres-large-pdo');

    await expect(fieldRow(page, 'pdo-size-22').getByTestId('decode-field-raw')).toHaveText(
      '0xC8 (200)',
    );
    await expect(fieldLengthCell(page, 'pdo-payload-24')).toHaveText('200');
    await expect(fieldRow(page, 'pdo-flag-en-18').getByTestId('decode-field-physical')).toHaveText(
      'Set',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('PRes: Size çerçeveden büyükse UYDURULMAZ, uyarı basılır ve yük telde olanla kırpılır', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'pres-size-exceeds-frame');

    await expect(fieldRow(page, 'pdo-size-22').getByTestId('decode-field-raw')).toHaveText(
      '0x200 (512)',
    );
    await expect(fieldWarning(page, 'pdo-size-22')).toContainText(
      tr['protocol.powerlink.warning.pdoSizeExceedsFrame'],
    );
    // Telde yalnız 36 bayt yük vardı (60 baytlık çerçeve − 24 ofset).
    await expect(fieldLengthCell(page, 'pdo-payload-24')).toHaveText('36');
  });

  test('SoA SyncRequest (PollResponse Chaining) alanlarının ofsetlerini kilitler', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'soa-sync-request');

    await expect(
      fieldRow(page, 'soa-requested-service-id-20').getByTestId('decode-field-physical'),
    ).toHaveText('SyncRequest');
    await expect(fieldOffsetCell(page, 'soa-sync-control-24')).toHaveText('24');
    await expect(fieldOffsetCell(page, 'soa-sync-pres-time-first-28')).toHaveText('28');
    await expect(fieldOffsetCell(page, 'soa-sync-destination-mac-48')).toHaveText('48');
    await expect(
      fieldRow(page, 'soa-sync-destination-mac-48').getByTestId('decode-field-raw'),
    ).toHaveText('02:00:00:01:00:01');
  });

  test('ASnd IdentResponse: IP alanları bayt sırası ÇAKIŞMASI yüzünden ham kalır ve alan uyarısı taşır', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'asnd-ident-response');

    await expect(
      fieldRow(page, 'asnd-service-id-17').getByTestId('decode-field-physical'),
    ).toHaveText('IdentResponse');
    await expect(
      fieldRow(page, 'ires-feature-flags-24').getByTestId('decode-field-physical'),
    ).toHaveText('0x0000000E');
    for (const id of ['ires-ip-address-84', 'ires-subnet-mask-88', 'ires-default-gateway-92']) {
      await expect(fieldWarning(page, id), id).toContainText(
        tr['protocol.powerlink.warning.ipFieldByteOrderConflict'],
      );
    }
    await expect(fieldWarning(page, 'ires-flags-21')).toContainText(
      tr['protocol.powerlink.warning.singleSourceField'],
    );
  });

  test('ASnd SDO: ReadByIndex isteğinin Index/Sub-index alt başlığını çözer', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'asnd-sdo-read-by-index');

    await expect(fieldRow(page, 'sdo-command-id-25').getByTestId('decode-field-physical')).toHaveText(
      'ReadByIndex',
    );
    await expect(
      fieldRow(page, 'sdo-object-index-30').getByTestId('decode-field-physical'),
    ).toHaveText('0x1006');
    await expect(
      fieldRow(page, 'sdo-object-sub-index-32').getByTestId('decode-field-physical'),
    ).toHaveText('0x00');
    await expect(fieldWarning(page, 'sdo-command-data-34')).toContainText(
      tr['protocol.powerlink.warning.sdoDataNeedsObjectDictionary'],
    );
  });

  test('ASnd SDO: Abort Code adlandırılmış mesajla gösterilir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'asnd-sdo-abort');

    await expect(fieldRow(page, 'sdo-flag-abort-24').getByTestId('decode-field-physical')).toHaveText(
      'Abort transfer',
    );
    await expect(fieldRow(page, 'sdo-abort-code-30').getByTestId('decode-field-physical')).toHaveText(
      'Object does not exist in the object dictionary',
    );
  });

  test('yanlış EtherType: MAC alanları çözülür ama MessageTypea DOKUNULMAZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await selectExample(page, 'ethertype-not-powerlink');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'start-delimiter-not-found');
    await expect(fieldRow(page, 'destination-mac')).toHaveCount(1);
    await expect(fieldRow(page, 'message-type')).toHaveCount(0);
  });

  test('çok kısa girdi decode-parse-error kartı basar (decode-frame-error DEĞİL)', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.hexInput.label']).fill('01 11 1E 00 00 01 02 00 00 F0 00 01');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('POWERLINK');

    await page.getByLabel(translations.en['decode.example.label']).selectOption('asnd-ident-response');
    await expectNoRawTranslationKeys(page);

    await page.getByLabel(translations.en['decode.example.label']).selectOption('ethertype-not-powerlink');
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'start-delimiter-not-found',
    );
    await expectNoRawTranslationKeys(page);
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
