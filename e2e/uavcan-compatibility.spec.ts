import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 15b'nin ikinci tarayıcı turu — UAVCAN Compatibility.
 *
 * Kanıtladığı şey: sayfa **Kısmi** rozetiyle açılıyor, ADAY TABLOSU görünüyor
 * (alan tablosu DEĞİL), belirsiz girdide "kullanıcı seçmeli" uyarısı basılıyor
 * ve kayıt otomatik algılamaya girmediğini AÇIKÇA söylüyor.
 */

const tr = translations.tr;

const DECODE_PATH =
  '/comm/aerospace-uav/distributed-uav-networks/uavcan-compatibility?tab=decode';

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

function frameWarning(page: Page, key: string): Locator {
  return page.getByTestId('decode-frame-warning').filter({ hasText: tr[key as keyof typeof tr] });
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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('UAVCAN Compatibility');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute(
    'data-plugin-id',
    'uavcan-compatibility',
  );
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  // Kayıt bir SEÇİCİDİR: kendi decodeOptions kanalı YOKTUR.
  await expect(page.getByTestId('decode-options')).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('aday tablosu görünür: Cyphal örneği HIGH, DroneCAN DIŞLANDI, karar Cyphal', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(fieldRow(page, 'evidence-sot').getByTestId('decode-field-physical')).toHaveText(
    'Set — the toggle bit below is decisive',
  );
  await expect(fieldRow(page, 'evidence-toggle').getByTestId('decode-field-physical')).toHaveText(
    'Set — Cyphal (UAVCAN v1) signature',
  );
  await expect(fieldRow(page, 'candidate-cyphal').getByTestId('decode-field-physical')).toContainText(
    'HIGH',
  );
  await expect(
    fieldRow(page, 'candidate-dronecan').getByTestId('decode-field-physical'),
  ).toContainText('EXCLUDED');
  await expect(fieldRow(page, 'decision').getByTestId('decode-field-physical')).toContainText(
    'Cyphal (UAVCAN v1)',
  );

  await expect(frameWarning(page, 'protocol.uavcanCompatibility.warning.selectCyphalPage')).toHaveCount(
    1,
  );
  // KOŞULSUZ iki uyarı: kaydın varlık sebebi.
  await expect(
    frameWarning(page, 'protocol.uavcanCompatibility.warning.classifierDoesNotDecode'),
  ).toHaveCount(1);
  await expect(
    frameWarning(page, 'protocol.uavcanCompatibility.warning.notInAutoDetection'),
  ).toHaveCount(1);

  // SINIFLANDIRIR, ÇÖZMEZ: iki hattın hiçbir protokol alanı üretilmez.
  for (const forbidden of ['subject-id', 'message-type-id', 'service-id', 'transfer-crc', 'data']) {
    await expect(fieldRow(page, forbidden), `alan üretilmemeli: ${forbidden}`).toHaveCount(0);
  }
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('DroneCAN örneği: Toggle=0 imzası Cyphal’i dışlar, DroneCAN sayfasına yönlendirir', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('dronecan-start-of-transfer');

  await expect(fieldRow(page, 'evidence-toggle').getByTestId('decode-field-physical')).toHaveText(
    'Not set — DroneCAN (UAVCAN v0) signature',
  );
  await expect(
    fieldRow(page, 'candidate-dronecan').getByTestId('decode-field-physical'),
  ).toContainText('HIGH');
  await expect(fieldRow(page, 'candidate-cyphal').getByTestId('decode-field-physical')).toContainText(
    'EXCLUDED',
  );
  await expect(fieldRow(page, 'decision').getByTestId('decode-field-physical')).toContainText(
    'DroneCAN (UAVCAN v0)',
  );
  await expect(
    frameWarning(page, 'protocol.uavcanCompatibility.warning.selectDroneCanPage'),
  ).toHaveCount(1);
  await expectNoRawTranslationKeys(page);
});

test('belirsiz devam çerçevesi: iki aday da LOW ve "kullanıcı seçmeli" uyarısı basılır', async ({
  page,
}) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('ambiguous-continuation');

  await expect(fieldRow(page, 'evidence-sot').getByTestId('decode-field-physical')).toHaveText(
    'Not set — continuation frame, no version evidence',
  );
  await expect(fieldRow(page, 'evidence-toggle').getByTestId('decode-field-physical')).toHaveText(
    'Not decisive on a continuation frame',
  );
  await expect(
    fieldRow(page, 'candidate-dronecan').getByTestId('decode-field-physical'),
  ).toContainText('LOW');
  await expect(fieldRow(page, 'candidate-cyphal').getByTestId('decode-field-physical')).toContainText(
    'LOW',
  );
  await expect(fieldRow(page, 'decision').getByTestId('decode-field-physical')).toContainText(
    'Ambiguous',
  );
  await expect(
    frameWarning(page, 'protocol.uavcanCompatibility.warning.ambiguousUserMustChoose'),
  ).toHaveCount(1);
  await expectNoRawTranslationKeys(page);
});

test('Transfer-ID paylaşılan alan olarak işaretlenir (ayrım ölçütü DEĞİL)', async ({ page }) => {
  await openDecodePanel(page);

  await expect(
    fieldRow(page, 'evidence-transfer-id').getByTestId('decode-field-physical'),
  ).toContainText('not a discriminator');
});

test('aday yok: ayrılmış bit 23 Cyphal’i, Toggle=1 DroneCAN’i dışlar', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('no-candidate');

  await expect(
    fieldRow(page, 'evidence-cyphal-reserved-23').getByTestId('decode-field-physical'),
  ).toContainText('requires discarding');
  await expect(fieldRow(page, 'decision').getByTestId('decode-field-physical')).toContainText(
    'No candidate',
  );
  await expect(frameWarning(page, 'protocol.uavcanCompatibility.warning.noCandidate')).toHaveCount(1);
  await expectNoRawTranslationKeys(page);
});

test('extended olmayan çerçeve: hata basar, hiçbir aday alanı üretilmez', async ({ page }) => {
  await openDecodePanel(page);

  await page.getByLabel(tr['decode.example.label']).selectOption('not-extended-rejected');

  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'value-out-of-range');
  await expect(fieldRow(page, 'decision')).toHaveCount(0);
  await expect(fieldRow(page, 'evidence-toggle')).toHaveCount(0);
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
