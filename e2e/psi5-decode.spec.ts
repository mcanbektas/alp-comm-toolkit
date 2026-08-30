import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 14h'in gerçek tarayıcı turu — PSI5, `automotive` domain'ini
 * kapatan kayıt.
 *
 * Kanıtladığı şeyler: sayfa KISMİ rozetiyle açılıyor (kapsam bilinçli olarak
 * dar, bu ekranda görünür); alan tablosunun İLK SATIRI yürürlükteki profili
 * adıyla ve kaynağıyla basıyor (`microwire.ts` kararı); seçenekler alan
 * tablosunu GERÇEKTEN değiştiriyor (yük genişliği + hata denetimi + alt alan);
 * çözülmeyen bölgeler (slot zaman çizelgesi, profil metadata'sı) uyarıyla
 * işaretli; CRC ve parite GERÇEKTEN doğrulanıp PASS/FAIL basılıyor —
 * `sent-decode.spec.ts`in "doğrulanmadı" biçiminden BİLEREK FARKLI.
 */

const tr = translations.tr;

const PSI5_DECODE_PATH = '/comm/automotive/sensor-interfaces/psi5?tab=decode';

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

function fieldWarning(page: Page, fieldId: string): Locator {
  // Tuzak (12d/12e/14e/14f/14g): alan uyarısı AYRI bir <tr>de basılır — köke bakılır.
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

test.describe('PSI5', () => {
  test('decode sekmesi KISMİ rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, PSI5_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PSI5');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'psi5');
    await expect(page.getByText(tr['status.partial'], { exact: true }).first()).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('alan tablosunun İLK SATIRI yürürlükteki profili adıyla ve kaynağıyla basar', async ({
    page,
  }) => {
    await openDecodePanel(page, PSI5_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('airbag-10-parity');

    const firstRow = page.locator('[data-testid="decode-field-row"]').first();
    await expect(firstRow).toHaveAttribute('data-field-id', 'profile');
    const raw = firstRow.getByTestId('decode-field-raw');
    await expect(raw).toContainText('V2.1');
    await expect(raw).toContainText('10 bit payload');
    await expect(raw).toContainText('Parity');
    // Kaynak da basılır — profil uydurulmadığı burada görünür.
    await expect(firstRow.getByTestId('decode-field-physical')).toContainText('psi5.org');
  });

  test('uygulama profili şıkkı ilk satırı DEĞİŞTİRİR ama yalnız metadata olduğunu söyler', async ({
    page,
  }) => {
    await openDecodePanel(page, PSI5_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('airbag-10-parity');

    await expect(
      fieldWarning(page, 'profile').filter({
        hasText: tr['protocol.psi5.warning.slotTimelineNotResolved'],
      }),
    ).toHaveCount(1);

    await page.getByLabel(tr['protocol.psi5.option.applicationProfile']).selectOption('airbag');
    const firstRow = page.locator('[data-testid="decode-field-row"]').first();
    await expect(firstRow.getByTestId('decode-field-raw')).toContainText('Airbag');
    await expect(
      fieldWarning(page, 'profile').filter({
        hasText: tr['protocol.psi5.warning.profileMetadataOnly'],
      }),
    ).toHaveCount(1);
  });

  test('yük genişliği + hata denetimi şıkları ALAN TABLOSUNU gerçekten değiştirir', async ({
    page,
  }) => {
    await openDecodePanel(page, PSI5_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('airbag-16-crc');

    // Varsayılan (10 bit + parite) yapılandırmayla bu yakalama UYUŞMAZ: artık bit uyarısı.
    await expect(fieldRow(page, 'parity')).toHaveCount(1);
    await expect(fieldRow(page, 'crc')).toHaveCount(0);
    await expect(
      page.getByTestId('decode-frame-warning').filter({
        hasText: tr['protocol.psi5.warning.trailingBits'],
      }),
    ).toHaveCount(1);

    await page.getByLabel(tr['protocol.psi5.option.payloadBitCount']).fill('16');
    await page.getByLabel(tr['protocol.psi5.option.errorCheck']).selectOption('crc3');

    // KP405'in çalışılmış örneği: yük 0xAD2C, CRC 0b100 → GERÇEKTEN doğrulanır.
    await expect(fieldRow(page, 'parity')).toHaveCount(0);
    await expect(fieldRow(page, 'crc')).toHaveCount(1);
    await expect(fieldRow(page, 'payload').getByTestId('decode-field-physical')).toHaveText('0xAD2C');
    await expect(fieldRow(page, 'crc').getByTestId('decode-field-raw')).toHaveText('0b100');
    await expect(fieldRow(page, 'crc').getByTestId('decode-field-physical')).toHaveText('Valid');
  });

  test('alt alan şıkları yeni satırlar açar; Region A kalanı alır', async ({ page }) => {
    await openDecodePanel(page, PSI5_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('airbag-16-crc');
    await page.getByLabel(tr['protocol.psi5.option.payloadBitCount']).fill('16');
    await page.getByLabel(tr['protocol.psi5.option.errorCheck']).selectOption('crc3');

    // Varsayılanda alt alanlar sıfır genişlikte, yalnız Region A var.
    await expect(fieldRow(page, 'messaging')).toHaveCount(0);
    await expect(fieldRow(page, 'regionA')).toHaveCount(1);

    // KP405 16-bit biçiminde yükün en düşük iki biti seri kanal (M0, M1).
    await page.getByLabel(tr['protocol.psi5.option.messagingBits']).fill('2');
    await expect(fieldRow(page, 'messaging')).toHaveCount(1);
    await expect(fieldRow(page, 'messaging')).toContainText('wire bit 2–3');
    await expect(fieldRow(page, 'regionA')).toContainText('wire bit 4–17');
  });

  test('parite ve start bitleri GERÇEKTEN doğrulanır — PASS/FAIL basılır', async ({ page }) => {
    await openDecodePanel(page, PSI5_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('airbag-10-parity');
    await expect(fieldRow(page, 'parity').getByTestId('decode-field-physical')).toHaveText('Valid');

    await page.getByLabel(tr['decode.example.label']).selectOption('bad-parity');
    await expect(fieldRow(page, 'parity').getByTestId('decode-field-physical')).toContainText(
      'Invalid',
    );
    await expect(
      page.getByTestId('decode-frame-error').filter({
        hasText: tr['protocol.psi5.error.parityMismatch'],
      }),
    ).toHaveCount(1);

    await page.getByLabel(tr['decode.example.label']).selectOption('start-bit-error');
    await expect(fieldRow(page, 'startBits')).toHaveAttribute('data-valid', 'false');
    await expect(
      fieldWarning(page, 'startBits').filter({
        hasText: tr['protocol.psi5.warning.startBitsNotZero'],
      }),
    ).toHaveCount(1);
  });

  test('eksik çerçeve boş kart değil, açıklamalı bir hata kartı basar', async ({ page }) => {
    await openDecodePanel(page, PSI5_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('truncated');

    await expect(page.getByTestId('decode-parse-error')).toBeVisible();
    await expect(page.getByTestId('decode-parse-error-message')).toContainText(
      tr['protocol.psi5.error.truncated'],
    );
  });

  test('İngilizce arayüzde de KISMİ rozeti ve profil satırı yerinde', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(PSI5_DECODE_PATH);
    await expect(page.getByTestId('decode-panel')).toBeVisible();

    await expect(page.getByText(translations.en['status.partial'], { exact: true }).first()).toBeVisible();
    await expect(
      page.getByLabel(translations.en['protocol.psi5.option.payloadBitCount']),
    ).toBeVisible();
  });
});
