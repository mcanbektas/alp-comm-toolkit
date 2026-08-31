import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * `Definitions` sekmesindeki A2L panelinin tarayıcı turu.
 *
 * Kanıtladığı şey: katalogda ADIYLA ertelenmiş olan iş kapandı. XCP kaydı
 * "Ham DTO baytları A2L olmadan anlamsızdır" diyordu; tur, aynı baytların
 * artık ölçüm adı, ECU adresi ve dönüşüm formülüyle birlikte fiziksel değere
 * çevrildiğini gösteriyor.
 */

const tr = translations.tr;

const XCP_CAN_PATH = '/comm/automotive/calibration/xcp-on-can?tab=definitions';
const CCP_PATH = '/comm/automotive/calibration/ccp?tab=definitions';
/**
 * Regresyon bekçisi: LIN `definitions: ['ldf']` taşır — yani BAŞKA bir biçim.
 * LDF dalgasına kadar burası "motoru olmayan biçim" örneğiydi ve "planlandı"
 * bildirimini kanıtlardı; LDF motoru gelince katalogda motorsuz biçim KALMADI,
 * bekçi de "panel biçime göre SEÇİLİYOR mu" testine çevrildi. Tam gerekçe:
 * `e2e/ldf-definitions.spec.ts`. Erişilemez hâle gelen "planlandı" yedek dalı
 * `src/pages/ProtocolPage.test.tsx`te birim testiyle kapsanıyor.
 */
const NON_A2L_PATH = '/comm/automotive/vehicle-network-protocols/lin?tab=definitions';

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

async function openA2lPanel(page: Page, path: string): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('a2l-panel')).toBeVisible();
  return consoleErrors;
}

function measurementRow(page: Page, name: string): Locator {
  return page.locator(`[data-testid="a2l-measurement-row"][data-measurement="${name}"]`);
}

async function selectMeasurement(page: Page, name: string): Promise<void> {
  // `exact` ŞART: "Ölçüm" etiketi "Ölçüm baytları (HEX)" içinde de geçiyor ve
  // gevşek eşleşme iki öğe bulup strict-mode ihlaline düşüyor.
  await page
    .getByLabel(tr['definition.a2l.measurement.label'], { exact: true })
    .selectOption(name);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test('definitions sekmesi A2L paneliyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openA2lPanel(page, XCP_CAN_PATH);

  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByTestId('a2l-load-failed')).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('ekran BOŞ açılmaz: örnek A2L yüklü gelir ve özetini basar', async ({ page }) => {
  await openA2lPanel(page, XCP_CAN_PATH);

  await expect(page.getByTestId('a2l-sample-notice')).toBeVisible();
  await expect(page.getByTestId('a2l-project')).toHaveText('ALP_DEMO');
  await expect(page.getByTestId('a2l-module')).toHaveText('ECU_MAIN');
  await expect(page.getByTestId('a2l-byte-order')).toHaveText('MSB_LAST');
  await expect(page.getByTestId('a2l-measurement-count')).toHaveText('5');
  await expect(page.getByTestId('a2l-characteristic-count')).toHaveText('1');
});

test('ölçüm tablosu ECU adresini ve dönüşüm türünü basar', async ({ page }) => {
  await openA2lPanel(page, XCP_CAN_PATH);

  await expect(page.getByTestId('a2l-measurement-row')).toHaveCount(5);
  await expect(measurementRow(page, 'EngineSpeed')).toContainText('0x800100');
  await expect(measurementRow(page, 'EngineSpeed')).toContainText('RAT_FUNC');
  await expect(measurementRow(page, 'CoolantTemperature')).toContainText('LINEAR');
  await expect(measurementRow(page, 'ThrottlePosition')).toContainText('FLOAT32_IEEE');
  await expect(page.getByTestId('a2l-issue')).toHaveCount(0);
});

test('RAT_FUNC’u TERS yönde çözer: 0x0FA0 ham 4000 → 1000 rpm', async ({ page }) => {
  await openA2lPanel(page, XCP_CAN_PATH);

  await expect(page.getByTestId('a2l-raw')).toHaveText('4000');
  // Katsayıyı doğrudan çarpan bir uygulama burada 16000 basardı.
  await expect(page.getByTestId('a2l-physical')).toHaveText('1000 rpm');
});

test('LINEAR ölçümü doğrudan yönde çevirir: 0xB4 → 50 degC', async ({ page }) => {
  await openA2lPanel(page, XCP_CAN_PATH);

  await selectMeasurement(page, 'CoolantTemperature');
  await expect(page.getByTestId('a2l-raw')).toHaveText('180');
  await expect(page.getByTestId('a2l-physical')).toHaveText('50 degC');
});

test('girdiye özel BYTE_ORDER modül varsayılanını ezer (float 50)', async ({ page }) => {
  await openA2lPanel(page, XCP_CAN_PATH);

  await selectMeasurement(page, 'ThrottlePosition');
  await expect(page.getByTestId('a2l-raw')).toHaveText('50');
});

test('TAB_VERB sözlüğünden vites adını basar (1 → First)', async ({ page }) => {
  await openA2lPanel(page, XCP_CAN_PATH);

  await selectMeasurement(page, 'GearState');
  await expect(page.getByTestId('a2l-raw')).toHaveText('1');
  await expect(page.getByTestId('a2l-physical')).toHaveText('First');
});

test('BIT_MASK’li ölçümü maskeleyip kaydırır (0x0500 → 5)', async ({ page }) => {
  await openA2lPanel(page, XCP_CAN_PATH);

  await selectMeasurement(page, 'LampState');
  await expect(page.getByTestId('a2l-raw')).toHaveText('5');
});

test('sözlükte karşılığı olmayan değerde nedenini yazar, uydurmaz', async ({ page }) => {
  await openA2lPanel(page, XCP_CAN_PATH);

  await selectMeasurement(page, 'GearState');
  await page.locator('#a2l-hex').fill('09');
  await expect(page.getByTestId('a2l-physical')).toHaveText('9');
  await expect(page.getByTestId('a2l-conversion-note')).toHaveText(
    tr['definition.a2l.note.noVerbalMatch'],
  );
});

test('bayt yetmiyorsa kaç bayt gerektiğini söyler', async ({ page }) => {
  await openA2lPanel(page, XCP_CAN_PATH);

  await selectMeasurement(page, 'ThrottlePosition');
  await page.locator('#a2l-hex').fill('42 48');
  const error = page.getByTestId('a2l-decode-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText('4');
  await expect(page.getByTestId('a2l-decoded')).toHaveCount(0);
});

test('geçersiz hex hata basar', async ({ page }) => {
  await openA2lPanel(page, XCP_CAN_PATH);

  await page.locator('#a2l-hex').fill('A0 ZZ');
  const hexError = page.getByTestId('a2l-hex-error');
  await expect(hexError).toBeVisible();
  await expect(hexError).toHaveText(tr['decode.error.invalidHex']);
  await expect(page.getByTestId('a2l-decoded')).toHaveCount(0);
});

test('CCP sayfasında da aynı panel açılır', async ({ page }) => {
  const consoleErrors = await openA2lPanel(page, CCP_PATH);

  await expect(page.getByTestId('a2l-measurement-count')).toHaveText('5');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('LIN kaydında bu panel AÇILMAZ, kaydın KENDİ biçimi olan LDF paneli açılır', async ({ page }) => {
  await openPage(page, NON_A2L_PATH);

  // Panel tanım biçimine bağlıdır, sekmenin varlığına değil: LIN yalnız
  // `ldf` sayıyor, o yüzden bu biçimin paneli açılmamalı ve LDF paneli açılmalı.
  await expect(page.getByTestId('a2l-panel')).toHaveCount(0);
  await expect(page.getByTestId('ldf-panel')).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openA2lPanel(page, XCP_CAN_PATH);
  await expect(page.getByTestId('a2l-measurement-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('a2l-measurement-table')).toBeVisible();
  expect(await horizontalOverflow(page), 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
