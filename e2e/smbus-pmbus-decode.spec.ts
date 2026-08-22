import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 11i'nin gerçek tarayıcı turu — SMBus + PMBus.
 *
 * Kanıtladığı şeyler: iki sayfanın da Hazır rozetiyle açıldığı; SMBus'ta PEC
 * alanının PASS/kapsam metniyle basıldığı ve PEC'siz örnekte HİÇ basılmadığı;
 * PMBus'ta komut kodunun adıyla, Linear11 telemetrisinin gerçek fiziksel
 * değerle ve STATUS_WORD'ün bit adlarıyla göründüğü; ULINEAR16 okumasında
 * uydurulmuş bir volt değeri BASILMADIĞI; DIRECT hesaplayıcısının katsayılarla
 * gerçek değeri ürettiği; her iki dilde de ham çeviri anahtarı sızmadığı.
 */

const tr = translations.tr;

const SMBUS_DECODE = '/comm/interfaces-framing/peripheral-buses/smbus?tab=decode';
const PMBUS_DECODE = '/comm/interfaces-framing/peripheral-buses/pmbus?tab=decode';
const PMBUS_TIMING = '/comm/interfaces-framing/peripheral-buses/pmbus?tab=timing';
const DIRECT_CALC = '/comm/calculators/pmbus-direct';

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

test.describe('SMBus', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, SMBUS_DECODE);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SMBus');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'smbus');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Read Word + PEC örneğinde PEC alanı PASS ve kapsamı gösterir', async ({ page }) => {
    await openDecodePanel(page, SMBUS_DECODE);

    await page.getByLabel(tr['decode.example.label']).selectOption('read-word-pec');

    await expect(fieldRow(page, 'address').getByTestId('decode-field-physical')).toHaveText(
      'Write · 7-bit 0x5A (0xB4)',
    );
    await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText('0x8B');
    await expect(fieldRow(page, 'repeatedAddress').getByTestId('decode-field-physical')).toHaveText(
      'Read · 7-bit 0x5A (0xB5)',
    );
    // "Calculated / coverage" üçlüsü spec özetinin PEC panelinden geliyor.
    await expect(fieldRow(page, 'pec').getByTestId('decode-field-physical')).toHaveText(
      'PASS · 0xBB · 5 B',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('PEC taşımayan örnekte PEC alanı hiç basılmaz', async ({ page }) => {
    await openDecodePanel(page, SMBUS_DECODE);

    await page.getByLabel(tr['decode.example.label']).selectOption('write-byte');

    await expect(fieldRow(page, 'command')).toHaveCount(1);
    await expect(fieldRow(page, 'pec')).toHaveCount(0);
  });

  test('Quick Command örneğinde yalnız Address alanı görünür', async ({ page }) => {
    await openDecodePanel(page, SMBUS_DECODE);

    await page.getByLabel(tr['decode.example.label']).selectOption('quick-command');

    await expect(fieldRow(page, 'address')).toHaveCount(1);
    await expect(fieldRow(page, 'command')).toHaveCount(0);
    await expect(fieldRow(page, 'writeData')).toHaveCount(0);
  });
});

test.describe('PMBus', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, PMBUS_DECODE);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PMBus');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'pmbus');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('READ_VIN örneği komut adını ve 12 V fiziksel değerini basar', async ({ page }) => {
    await openDecodePanel(page, PMBUS_DECODE);

    await page.getByLabel(tr['decode.example.label']).selectOption('read-vin');

    await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText(
      'READ_VIN (0x88)',
    );
    const data = fieldRow(page, 'data').getByTestId('decode-field-physical');
    await expect(data).toContainText('12 V');
    await expect(data).toContainText('N=-6');
  });

  test('STATUS_WORD örneği bit adlarını iki ayrı alanda gösterir', async ({ page }) => {
    await openDecodePanel(page, PMBUS_DECODE);

    await page.getByLabel(tr['decode.example.label']).selectOption('status-word');

    await expect(fieldRow(page, 'statusLow').getByTestId('decode-field-physical')).toHaveText('OFF');
    await expect(fieldRow(page, 'statusHigh').getByTestId('decode-field-physical')).toHaveText(
      'PG_STATUS#',
    );
  });

  test('VOUT_MODE örneği modu ve üssü çözer', async ({ page }) => {
    await openDecodePanel(page, PMBUS_DECODE);

    await page.getByLabel(tr['decode.example.label']).selectOption('vout-mode');

    await expect(fieldRow(page, 'data').getByTestId('decode-field-physical')).toHaveText(
      'ULINEAR16 · Absolute · exponent -9',
    );
  });

  test('COEFFICIENTS örneği m/b/R değerlerini ve byte count alanını gösterir', async ({ page }) => {
    await openDecodePanel(page, PMBUS_DECODE);

    await page.getByLabel(tr['decode.example.label']).selectOption('coefficients');

    await expect(fieldRow(page, 'blockCount').getByTestId('decode-field-physical')).toHaveText('5 B');
    await expect(fieldRow(page, 'data').getByTestId('decode-field-physical')).toHaveText(
      'm=1, b=-100, R=3',
    );
  });

  test('Zamanlama sekmesi iki PMBus hesaplayıcısına bağlanır', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(PMBUS_TIMING);

    await expect(page.getByRole('link', { name: tr['calc.pmbusLinear.name'] })).toBeVisible();
    await expect(page.getByRole('link', { name: tr['calc.pmbusDirect.name'] })).toBeVisible();
  });
});

test.describe('PMBus DIRECT hesaplayıcısı', () => {
  test('varsayılan katsayılarla ham word gerçek değere çözülür', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });

    await page.goto(DIRECT_CALC);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(tr['calc.pmbusDirect.name']);

    // Varsayılan: Y=0x2EE0, m=1, b=0, R=3 → 12 (SMIF APEC 2017 sadeleştirmesi).
    await expect(page.getByText('12', { exact: true }).first()).toBeVisible();
    // COEFFICIENTS bölümü: 01 00 9C FF 03 → m=1, b=-100, R=3.
    await expect(page.getByText('-100', { exact: true })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });
});

test.describe('çeviri bütünlüğü', () => {
  test('iki dilde de ham çeviri anahtarı sızmıyor', async ({ page }) => {
    for (const [language, path] of [
      ['tr', SMBUS_DECODE],
      ['en', PMBUS_DECODE],
    ] as const) {
      await page.addInitScript((value: string) => {
        window.localStorage.setItem('alp-comm-lang', value);
      }, language);
      await page.goto(path);
      await expect(page.getByTestId('decode-panel')).toBeVisible();
      const body = await page.locator('body').innerText();
      expect(body, `${language} sayfasında ham anahtar var`).not.toContain('protocol.smbus.');
      expect(body, `${language} sayfasında ham anahtar var`).not.toContain('protocol.pmbus.');
      expect(body, `${language} sayfasında ham anahtar var`).not.toContain('calc.field.');
    }
  });
});
