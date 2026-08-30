import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 15c'nin gerçek tarayıcı turu — IBUS.
 *
 * Kanıtladığı şey: `decode-options` formunun GERÇEKTEN basıldığı ve `profile`
 * seçeneğinin GERÇEKTEN `parse()`e ulaştığı — AYNI baytların profil
 * değişince checksum sonucunu DEĞİŞTİRDİĞİ (brief-faz10-dalga15c.md
 * "decodeOptions" tablosu: "yanlış seçim checksum'ı her çerçevede FAIL
 * gösterir"); üst nibble'ın HAM + çift-kaynaklı uyarıyla göründüğü; i-BUS2
 * kapsam-dışı uyarısının HER zaman göründüğü — `microwire-i3c-decode.spec.ts`
 * (decodeOptions deseni) + `dronecan-decode.spec.ts` (genel iskelet) emsali.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/aerospace-uav/rc-control-links/ibus?tab=decode';

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

/**
 * Alan seviyesindeki uyarı AYRI bir `<tr>`de basılır — `fieldRow(...)
 * .getByTestId('decode-field-warning')` BOŞ döner (devralınan tuzak,
 * brief-faz10-dalga15c.md "DecodePanel e2e tuzakları"). Kökten aranır.
 */
function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

/** Birden çok çerçeve uyarısı olduğunda strict-mode ihlalini önler (Devralınan tuzaklar). */
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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('IBUS');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ibus');
  // `partial`: klasik i-BUS TAM çözülür, yalnız i-BUS2 kapsam dışı (dosya başı).
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('decode-options formu görünür ve profil seçenekleri iA6B/iA6 sunar', async ({ page }) => {
  await openDecodePanel(page);

  await expect(page.getByTestId('decode-options')).toBeVisible();
  const profileSelect = page.getByLabel(tr['protocol.ibus.option.profile']);
  await expect(profileSelect).toBeVisible();
  await expect(profileSelect.locator('option')).toHaveCount(2);
  const optionTexts = await profileSelect.locator('option').allTextContents();
  expect(optionTexts).toEqual([
    tr['protocol.ibus.option.profile.ia6b'],
    tr['protocol.ibus.option.profile.ia6'],
  ]);
});

test('ia6b-typical örneği 14 kanalı doğru çözer, komut RC Channel Command, checksum PASS', async ({
  page,
}) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('ia6b-typical');

  await expect(fieldRow(page, 'length').getByTestId('decode-field-raw')).toHaveText('0x20 (32)');
  await expect(fieldRow(page, 'command').getByTestId('decode-field-physical')).toHaveText(
    'RC Channel Command',
  );
  // Kanallar 1000, 1050, …, 1650 (i×50+1000).
  await expect(fieldRow(page, 'ibus-channel-0').getByTestId('decode-field-raw')).toHaveText('0x3E8 (1000)');
  await expect(fieldRow(page, 'ibus-channel-13').getByTestId('decode-field-raw')).toHaveText(
    '0x672 (1650)',
  );
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('üst nibble alanları HAM basılır ve çift-kaynaklı belirsizlik uyarısı taşır', async ({ page }) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('ia6b-typical');

  // Fixture: nibble[i] = i (0..13).
  await expect(fieldRow(page, 'ibus-channel-0-upper-nibble').getByTestId('decode-field-raw')).toHaveText(
    '0x0 (0)',
  );
  await expect(fieldRow(page, 'ibus-channel-5-upper-nibble').getByTestId('decode-field-raw')).toHaveText(
    '0x5 (5)',
  );
  await expect(fieldWarning(page, 'ibus-channel-0-upper-nibble')).toHaveCount(1);
  await expect(
    fieldWarning(page, 'ibus-channel-0-upper-nibble').getByText(
      tr['protocol.ibus.warning.upperNibbleAmbiguous'],
    ),
  ).toBeVisible();
});

test('komut baytı 0x40 değilse uyarır ama checksum yine PASS eder (Betaflight yolu)', async ({ page }) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('ia6b-non-standard-command');

  await expect(fieldRow(page, 'command').getByTestId('decode-field-raw')).toHaveText('0x8 (8)');
  await expect(
    frameWarning(page, 'protocol.ibus.warning.unexpectedCommandByte'),
  ).toHaveCount(1);
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('ia6b-checksum-mismatch örneği decode-frame-error checksum-mismatch basar', async ({ page }) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('ia6b-checksum-mismatch');

  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('FAIL');
  const frameError = page.getByTestId('decode-frame-error');
  await expect(frameError).toHaveCount(1);
  await expect(frameError).toHaveAttribute('data-error-code', 'checksum-mismatch');
  // Hatalı checksum'a rağmen kanallar yine gösterilir.
  await expect(fieldRow(page, 'ibus-channel-0').getByTestId('decode-field-raw')).toHaveText('0x3E8 (1000)');
  await expectNoRawTranslationKeys(page);
});

test('PROFİL DEĞİŞİNCE checksum sonucu GERÇEKTEN değişir — AYNI baytlar, farklı yorum', async ({
  page,
}) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('ia6b-typical');

  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('PASS');

  await page.getByLabel(tr['protocol.ibus.option.profile']).selectOption('ia6');

  // Aynı bayt dizisi artık iA6 kurallarıyla (farklı senkron/offset/checksum
  // algoritması) yorumlanıyor — checksum PASS'ten FAIL'e döner.
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('FAIL');
  // Kanal offset'i de kaymıştır: iA6'da CH1 byte 1'de başlar (iA6B'de byte 2).
  await expect(fieldRow(page, 'sync')).toHaveCount(1);
  await expect(fieldRow(page, 'length')).toHaveCount(0);
});

test('ia6-typical örneği yalnız profil iA6 seçiliyken PASS eder — varsayılan iA6B ile truncated', async ({
  page,
}) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('ia6-typical');

  // Varsayılan profil iA6B'dir; 31 baytlık bir iA6 çerçevesi iA6B'nin 32
  // baytlık asgari uzunluğunu karşılamaz → parse hatası (decode-parse-error,
  // decode-frame-error DEĞİL — ParseResult.success:false, henüz frame yok).
  await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
  await expect(page.getByTestId('decode-parse-error')).toHaveAttribute('data-error-code', 'truncated-frame');

  await page.getByLabel(tr['protocol.ibus.option.profile']).selectOption('ia6');

  await expect(fieldRow(page, 'sync').getByTestId('decode-field-raw')).toHaveText('0x55 (85)');
  await expect(fieldRow(page, 'checksum').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expect(fieldRow(page, 'ibus-channel-0').getByTestId('decode-field-raw')).toHaveText('0x3E8 (1000)');
});

test('i-BUS2 kapsam-dışı uyarısı HER başarılı çözümde görünür', async ({ page }) => {
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('ia6b-typical');

  await expect(frameWarning(page, 'protocol.ibus.warning.ibus2OutOfScope')).toHaveCount(1);
  // Seçenek açıklamasında da kapsam sınırı AÇIKÇA yazılı.
  await expect(page.getByText(tr['protocol.ibus.option.profile.description'])).toBeVisible();
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await page.getByLabel(tr['decode.example.label']).selectOption('ia6b-typical');
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
});
