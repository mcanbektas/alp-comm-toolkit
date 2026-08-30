import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 18d'nin gerçek tarayıcı turu — Thread.
 *
 * Motor seviyesi dört dosyada doğrulandı (`ieee802154Frame.test.ts`,
 * `auxSecurityHeader.test.ts` + `lowpan.test.ts` + `mle.test.ts`,
 * `thread.test.ts`, `threadCanParseRegistry.test.ts`); bu dosya motoru değil
 * motor↔ekran bağlantısını sınar (desen `esp-now-decode.spec.ts`).
 */

const tr = translations.tr;
const DECODE_PATH = '/comm/wireless-iot/mesh-smart-home/thread?tab=decode';

/**
 * `decode-*` alan/uyarı metinlerinin çeviri anahtarı GİBİ görünmemesi gerekir.
 * Nokta sonrası bölüm HARFLE başlamak zorunda; yoksa `802.15.4 Security` gibi
 * meşru veri adları "anahtar" sanılırdı — bu sayfada tam olarak o metin var.
 */
const RAW_TRANSLATION_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/;

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

function frameWarning(page: Page, text: string): Locator {
  return page.getByTestId('decode-frame-warning').filter({ hasText: text });
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

async function selectOption(page: Page, optionId: string, value: string): Promise<void> {
  await page.locator(`#decode-option-${optionId}`).selectOption(value);
}

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  const testIds = [
    'decode-field-physical',
    'decode-field-raw',
    'decode-frame-warning',
    'decode-field-warning',
    'decode-frame-error',
  ];
  for (const testId of testIds) {
    const texts = await page.getByTestId(testId).allTextContents();
    for (const text of texts) {
      const trimmed = text.trim();
      expect(
        RAW_TRANSLATION_KEY_PATTERN.test(trimmed),
        `ham çeviri anahtarı sızmış olabilir (${testId}): "${trimmed}"`,
      ).toBe(false);
    }
  }
}

test('decode sekmesi Kısmi rozetiyle açılır, konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openDecodePanel(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thread');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'thread');
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('örnek 1 — gerçek yakalama: IPv6 adresleri, UDP portları ve "Hello 003 0xC59A" ekranda', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'uncompressed-ipv6');

  await expect(fieldRow(page, 'mac-dest-addr').getByTestId('decode-field-raw')).toContainText(
    '00:1C:DA:FF:FF:00:18:8A',
  );
  await expect(fieldRow(page, 'ipv6-source').getByTestId('decode-field-raw')).toContainText(
    'fe80::1c:daff:ff00:1888',
  );
  await expect(fieldRow(page, 'ipv6-payload-length').getByTestId('decode-field-raw')).toContainText(
    '25',
  );
  await expect(fieldRow(page, 'udp-length').getByTestId('decode-field-raw')).toContainText('25');
  await expect(fieldRow(page, 'udp-payload').getByTestId('decode-field-physical')).toContainText(
    'Hello 003 0xC59A',
  );
  await expect(fieldRow(page, 'mac-fcs').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expect(fieldRow(page, 'mac-fcs')).toHaveAttribute('data-valid', 'true');
});

test('örnek 2/3 — aynı datagram_tag, FRAGN offset 96 (FRAG1\'in yük uzunluğu)', async ({ page }) => {
  await openDecodePanel(page);

  await selectExample(page, 'fragment-first');
  await expect(
    fieldRow(page, 'lowpan-frag-datagram-size').getByTestId('decode-field-raw'),
  ).toContainText('265');
  await expect(
    fieldRow(page, 'lowpan-frag-datagram-tag').getByTestId('decode-field-physical'),
  ).toHaveText('2');

  await selectExample(page, 'fragment-subsequent');
  await expect(
    fieldRow(page, 'lowpan-frag-datagram-tag').getByTestId('decode-field-physical'),
  ).toHaveText('2');
  await expect(
    fieldRow(page, 'lowpan-frag-datagram-offset').getByTestId('decode-field-physical'),
  ).toContainText('96');
  await expect(
    frameWarning(page, tr['protocol.thread.warning.fragmentNotReassembled']),
  ).toHaveCount(1);
});

test('örnek 4 — LOWPAN_HC1: "kapsam dışı" der, çökmez, IPv6 UYDURMAZ', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'lowpan-hc1');

  await expect(
    fieldRow(page, 'lowpan-hc1-dispatch').getByTestId('decode-field-physical'),
  ).toHaveText('LOWPAN_HC1');
  await expect(fieldRow(page, 'lowpan-hc1-dispatch')).toHaveAttribute('data-valid', 'false');
  await expect(frameWarning(page, tr['protocol.thread.warning.hc1OutOfScope'])).toHaveCount(1);
  // Boş kart değil, açık bir kapsam bildirimi: FCS yine PASS, IPv6 alanı YOK.
  await expect(fieldRow(page, 'mac-fcs').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expect(fieldRow(page, 'ipv6-source')).toHaveCount(0);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
});

test('örnek 5 — MLE: Security Suite 255 ve "Discovery Request" ekranda', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'mle-discovery-request');

  await expect(fieldRow(page, 'udp-source-port').getByTestId('decode-field-raw')).toContainText(
    '19788',
  );
  await expect(
    fieldRow(page, 'mle-security-suite').getByTestId('decode-field-physical'),
  ).toHaveText('No Security');
  await expect(fieldRow(page, 'mle-command').getByTestId('decode-field-physical')).toHaveText(
    'Discovery Request',
  );
  // Adresler tamamen elenmiş ve MAC'ten TÜRETİLDİ — ölçüm değil, bildirim.
  await expect(
    fieldRow(page, 'iphc-source-address').getByTestId('decode-field-raw'),
  ).toContainText('fe80::21c:daff:ff00:1888');
  // İKİ adres de türetildi (kaynak + hedef) ⇒ uyarı İKİ kez düşer.
  await expect(frameWarning(page, tr['protocol.thread.warning.iidDerived'])).toHaveCount(2);
});

test('🚨 örnek 6 — şifreli MLE: komut tipi BASILMAZ, MIC PASS/FAIL BASILMAZ', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'mle-encrypted');

  await expect(
    fieldRow(page, 'mle-security-suite').getByTestId('decode-field-physical'),
  ).toHaveText('802.15.4 Security');
  await expect(fieldRow(page, 'mle-sec-level').getByTestId('decode-field-physical')).toHaveText(
    'ENC-MIC-32',
  );
  // Komut tipi UYDURULMAZ: satır HİÇ YOK.
  await expect(fieldRow(page, 'mle-command')).toHaveCount(0);
  await expect(fieldRow(page, 'mle-encrypted-payload')).toBeVisible();
  // MIC bir ALAN olarak var ama PASS/FAIL BASILMIYOR: fiziksel değer hücresi
  // BOŞ glif taşır. `mac-fcs`in aynı hücresi "PASS" der — ayrım ekranda.
  await expect(fieldRow(page, 'mle-sec-mic')).toBeVisible();
  await expect(fieldRow(page, 'mle-sec-mic').getByTestId('decode-field-physical')).toHaveText('—');
  await expect(fieldRow(page, 'mac-fcs').getByTestId('decode-field-physical')).toHaveText('PASS');
  await expect(
    frameWarning(page, tr['protocol.thread.warning.encryptedCommandNotReadable']),
  ).toHaveCount(1);
  await expect(frameWarning(page, tr['protocol.thread.warning.micNotVerifiable'])).toHaveCount(1);

  // `encryptedPayloadDisplay` yalnız GÖSTERİMİ değiştirir.
  await selectOption(page, 'encryptedPayloadDisplay', 'hex');
  await expect(
    fieldRow(page, 'mle-encrypted-payload').getByTestId('decode-field-physical'),
  ).toContainText('9C 4E 71 2B');
});

test('örnek 7 — MAC güvenliği: MIC yükten düşülür, 6LoWPAN zincirine GİRİLMEZ', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'mac-security-mic');

  await expect(fieldRow(page, 'mac-sec-level').getByTestId('decode-field-physical')).toHaveText(
    'ENC-MIC-32',
  );
  await expect(fieldRow(page, 'mac-encrypted-payload')).toBeVisible();
  await expect(fieldRow(page, 'mac-sec-mic')).toBeVisible();
  await expect(fieldRow(page, 'iphc-dispatch')).toHaveCount(0);
  await expect(frameWarning(page, tr['protocol.thread.warning.macPayloadEncrypted'])).toHaveCount(1);

  // `securityLevelOverride` MIC uzunluğunu değiştirir ⇒ yükün sonu KAYAR.
  await selectOption(page, 'securityLevelOverride', '6');
  await expect(fieldRow(page, 'mac-sec-mic').getByTestId('decode-field-raw')).toBeVisible();
});

test('örnek 8 — Mesh: Hops Left 0xF ⇒ Deep Hops Left, sonra MLE Discovery Response', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'mesh-deep-hops');

  await expect(
    fieldRow(page, 'lowpan-mesh-hops-left').getByTestId('decode-field-raw'),
  ).toContainText('15');
  await expect(fieldRow(page, 'lowpan-mesh-deep-hops-left')).toBeVisible();
  await expect(fieldRow(page, 'mle-command').getByTestId('decode-field-physical')).toHaveText(
    'Discovery Response',
  );
});

test('dispatchProfile kanalı 0x7F baytının ANLAMINI değiştirir (IPHC ↔ ESC)', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'nhc-udp-compressed');

  await expect(fieldRow(page, 'iphc-dispatch')).toBeVisible();
  await expect(fieldRow(page, 'nhc-udp-ports').getByTestId('decode-field-physical')).toHaveText(
    'both 4-bit (0xF0Bx)',
  );

  await selectOption(page, 'dispatchProfile', 'rfc4944-full');
  await expect(fieldRow(page, 'iphc-dispatch')).toHaveCount(0);
  await expect(fieldRow(page, 'lowpan-esc-dispatch').getByTestId('decode-field-physical')).toHaveText(
    'ESC',
  );
  // ESC bir EK dispatch baytı TÜKETİR — kanal bayt düzeyinde karar veriyor.
  await expect(fieldRow(page, 'lowpan-esc-extension')).toBeVisible();
});

test('udpChecksumElided kanalı yükü İKİ BAYT kaydırır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'nhc-udp-compressed');
  await expect(fieldRow(page, 'udp-checksum')).toBeVisible();

  await selectOption(page, 'udpChecksumElided', 'elided');
  await expect(fieldRow(page, 'udp-checksum')).toHaveCount(0);
  await expect(
    frameWarning(page, tr['protocol.thread.warning.udpChecksumElidedOnWire']),
  ).toHaveCount(1);
});

test('mlePort kanalı sınıflandırmanın KAPISIDIR', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'uncompressed-ipv6');
  await expect(frameWarning(page, tr['protocol.thread.warning.notMlePort'])).toHaveCount(1);
  await expect(fieldRow(page, 'mle-security-suite')).toHaveCount(0);

  // Yakalamanın portu 0xF0B1 = 61617; kapı oraya taşınınca yük MLE sayılır.
  await page.locator('#decode-option-mlePort').fill('61617');
  await expect(fieldRow(page, 'mle-security-suite')).toBeVisible();
  await expect(frameWarning(page, tr['protocol.thread.warning.notMlePort'])).toHaveCount(0);
});

test('fcsPresent / addressDisplay kanalları', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'nhc-udp-compressed');
  await expect(fieldRow(page, 'mac-fcs')).toBeVisible();

  await selectOption(page, 'fcsPresent', 'no');
  await expect(fieldRow(page, 'mac-fcs')).toHaveCount(0);

  await selectOption(page, 'addressDisplay', 'raw');
  await expect(fieldRow(page, 'mac-src-addr').getByTestId('decode-field-raw')).toContainText(
    '88 18 00 FF FF DA 1C 00',
  );
});

test('örnek 10 — bozuk FCS: crc-mismatch basılır, alanlar YİNE DE çözülür', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'fcs-mismatch');

  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
    'data-error-code',
    'crc-mismatch',
  );
  await expect(fieldRow(page, 'mac-fcs').getByTestId('decode-field-physical')).toHaveText('FAIL');
  await expect(fieldRow(page, 'ipv6-source')).toBeVisible();
});

test('girdi sözleşmesi her çözümde söylenir — TAP/ZEP KAPSAM DIŞI', async ({ page }) => {
  await openDecodePanel(page);
  await expect(frameWarning(page, tr['protocol.thread.warning.linkTypeContract'])).toHaveCount(1);
});

test('on örneğin hiçbirinde çevrilmemiş ham anahtar sızmaz', async ({ page }) => {
  await openDecodePanel(page);
  const exampleIds = [
    'uncompressed-ipv6',
    'fragment-first',
    'fragment-subsequent',
    'lowpan-hc1',
    'mle-discovery-request',
    'mle-encrypted',
    'mac-security-mic',
    'mesh-deep-hops',
    'nhc-udp-compressed',
    'fcs-mismatch',
  ];
  for (const exampleId of exampleIds) {
    await selectExample(page, exampleId);
    await expectNoRawTranslationKeys(page);
  }
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await openDecodePanel(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${String(width)}px genişlikte yatay taşma`).toBeLessThanOrEqual(1);
  }
});
