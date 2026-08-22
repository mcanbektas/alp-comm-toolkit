import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 12e'nin gerçek tarayıcı turu — SNMP.
 *
 * Kanıtladığı şey: `berReader.ts`in TLV yürüyüşünün tarayıcıda gerçekten
 * koştuğu, OID'in base-128'den açılıp adlandırıldığı, Counter32'nin işaretsiz
 * kaldığı, GetBulk'un hata alanı BASMADIĞI ve şifreli v3 ScopedPDU'sunun
 * çözülmediğini söylediği — dns-decode.spec.ts'in deseni.
 */

const tr = translations.tr;

const SNMP_PATH = '/comm/network-ethernet/time-management/snmp?tab=decode';

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

/** Alan uyarısı AYRI bir `<tr>`de basılır (DecodePanel.tsx:272). */
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

test.describe('SNMP', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, SNMP_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SNMP');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'snmp');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('GetRequest örneği sürümü v2c adlandırır ve OID’i çözer', async ({ page }) => {
    await openDecodePanel(page, SNMP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('get-request-v2c');

    // Ham 1 değil: sürüm alanı sıfır tabanlı.
    await expect(fieldRow(page, 'version').getByTestId('decode-field-physical')).toHaveText('SNMPv2c');
    await expect(fieldRow(page, 'community').getByTestId('decode-field-raw')).toHaveText('public');
    await expect(fieldRow(page, 'pdu-type').getByTestId('decode-field-physical')).toHaveText('GetRequest');
    await expect(fieldRow(page, 'varbind-0-oid').getByTestId('decode-field-raw')).toHaveText('1.3.6.1.2.1.1.3.0');
    await expect(fieldRow(page, 'varbind-0-oid').getByTestId('decode-field-physical')).toHaveText('sysUpTime.0');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('TimeTicks süre olarak biçimlenir, saniye sanılmaz', async ({ page }) => {
    await openDecodePanel(page, SNMP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('response-timeticks');

    await expect(fieldRow(page, 'varbind-0-type').getByTestId('decode-field-physical')).toHaveText('TimeTicks');
    // Birim eklenmez: biçimlenmiş süre "cs" ekiyle centisaniye gibi okunurdu.
    await expect(fieldRow(page, 'varbind-0-value').getByTestId('decode-field-physical')).toHaveText('0d 01:00:00.00');
    await expectNoRawTranslationKeys(page);
  });

  test('yüksek Counter32 pozitif kalır', async ({ page }) => {
    await openDecodePanel(page, SNMP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('response-counter32-high');

    await expect(fieldRow(page, 'varbind-0-type').getByTestId('decode-field-physical')).toHaveText('Counter32');
    await expect(fieldRow(page, 'varbind-0-value').getByTestId('decode-field-raw')).toContainText('3000000000');
    await expectNoRawTranslationKeys(page);
  });

  test('GetBulk hata alanı basmaz, non-repeaters/max-repetitions basar', async ({ page }) => {
    await openDecodePanel(page, SNMP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('get-bulk-request');

    await expect(fieldRow(page, 'non-repeaters')).toBeVisible();
    await expect(fieldRow(page, 'max-repetitions').getByTestId('decode-field-raw')).toContainText('10');
    await expect(fieldRow(page, 'error-status')).toHaveCount(0);
    await expect(fieldRow(page, 'error-index')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('v1 Trap gövdesi standart PDU alanlarını üretmez', async ({ page }) => {
    await openDecodePanel(page, SNMP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('trap-v1');

    await expect(fieldRow(page, 'pdu-type').getByTestId('decode-field-physical')).toHaveText('Trap (v1)');
    await expect(fieldRow(page, 'enterprise').getByTestId('decode-field-raw')).toHaveText('1.3.6.1.4.1.9');
    await expect(fieldRow(page, 'agent-address').getByTestId('decode-field-raw')).toHaveText('192.168.1.10');
    await expect(fieldRow(page, 'generic-trap').getByTestId('decode-field-physical')).toHaveText('linkDown');
    await expect(fieldRow(page, 'request-id')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('v3 örneği USM parametrelerini okur ama ScopedPDU’yu şifreli bırakır', async ({ page }) => {
    await openDecodePanel(page, SNMP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('v3-encrypted');

    await expect(fieldRow(page, 'security-level').getByTestId('decode-field-physical')).toHaveText('authPriv');
    await expect(fieldRow(page, 'usm-user-name').getByTestId('decode-field-raw')).toHaveText('operator');
    await expect(fieldRow(page, 'encrypted-scoped-pdu').getByTestId('decode-field-physical')).toHaveText('Encrypted');
    await expect(fieldWarning(page, 'encrypted-scoped-pdu')).toHaveText(
      tr['protocol.snmp.warning.encryptedScopedPdu'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('SEQUENCE olmayan girdi çözüm hatası kartı basar, sayfa çökmez', async ({ page }) => {
    await openDecodePanel(page, SNMP_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('not-a-sequence');

    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute(
      'data-error-code',
      'start-delimiter-not-found',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(SNMP_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SNMP');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('response-no-such-object');
    await expect(fieldRow(page, 'varbind-0-type').getByTestId('decode-field-physical')).toHaveText('noSuchObject');
    await expectNoRawTranslationKeys(page);
  });
});
