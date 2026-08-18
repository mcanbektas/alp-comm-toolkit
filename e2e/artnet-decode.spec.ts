import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 6b'nin gerçek tarayıcı turu — Art-Net.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (building-automation/lighting-networks/
 * art-net) Hazır rozetiyle açıldığı; ArtDmx'te Data[0]'ın doğrudan Kanal/Slot 1
 * olduğu (dmx512'deki start code kayması burada YOK — `start-code` diye bir
 * alan hiç basılmıyor); 512 kanallı universe'da yalnız ilk 16 kanalın ayrı
 * satır olduğu; ArtPoll'un DiagPriority'sinin Table 5'ten adlandırıldığı;
 * ArtPollReply'de IP/Port/PortName'in adlandırılıp aradaki ve sonraki
 * alanların ham blok kaldığı; az bilinen bir OpCode'un (ArtTimeCode) adıyla
 * tanınıp gövdesinin ham + uyarıyla kaldığı; tanınmayan bir OpCode'un uyarı
 * bastığı; bozuk imzanın (Art-Net değil) hata yolunu izlediği; Length alanı
 * tutarsızlığının hata değil uyarı bastığı.
 *
 * 6a (dmx512) emsalinde: BEKÇİ BORCU yok, alias sayfası yok — devralma testi
 * gerekmedi.
 */

const tr = translations.tr;

const CANONICAL_DECODE_PATH = '/comm/building-automation/lighting-networks/art-net?tab=decode';

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

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test.describe('Art-Net', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Art-Net');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'art-net');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('ArtDmx mutlu yol: Data[0] doğrudan Kanal 1’dir, start-code alanı YOKTUR', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('art-dmx-happy-path');

    await expect(fieldRow(page, 'start-code')).toHaveCount(0);
    await expect(fieldRow(page, 'slot-1').getByTestId('decode-field-raw')).toHaveText('0xFF (255)');
    await expect(fieldRow(page, 'slot-2').getByTestId('decode-field-raw')).toHaveText('0x80 (128)');
    await expect(fieldRow(page, 'slot-3').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
    await expect(fieldRow(page, 'slot-4').getByTestId('decode-field-raw')).toHaveText('0xC8 (200)');
    await expect(fieldRow(page, 'sequence').getByTestId('decode-field-physical')).toHaveText('Disabled');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('ArtDmx tam 512 kanalda yalnız ilk 16 satır ayrı, kalanı özet alanda toplanır', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('art-dmx-full-512-universe');

    await expect(fieldRow(page, 'slot-1')).toHaveCount(1);
    await expect(fieldRow(page, 'slot-16')).toHaveCount(1);
    await expect(fieldRow(page, 'slot-17')).toHaveCount(0);
    await expect(fieldRow(page, 'slot-512')).toHaveCount(0);
    await expect(fieldRow(page, 'slot-data').getByTestId('decode-field-select')).toHaveText('Slots 17-512');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('ArtPoll: DiagPriority Table 5’ten adlandırılır', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('art-poll-basic');

    await expect(fieldRow(page, 'flags').getByTestId('decode-field-raw')).toHaveText('0x2 (2)');
    await expect(fieldRow(page, 'diag-priority').getByTestId('decode-field-physical')).toHaveText('DpHigh');
    await expect(fieldRow(page, 'diag-priority')).toHaveAttribute('data-valid', 'true');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('ArtPollReply: IP/Port/PortName adlandırılır, aradaki ve sonraki alanlar ham blok kalır', async ({
    page,
  }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('art-poll-reply-partial');

    await expect(fieldRow(page, 'ip-address').getByTestId('decode-field-raw')).toHaveText('192.168.1.50');
    await expect(fieldRow(page, 'port').getByTestId('decode-field-raw')).toHaveText('0x1936 (6454)');
    await expect(fieldRow(page, 'port-name').getByTestId('decode-field-raw')).toHaveText('Art-Net Node 1');
    await expect(fieldRow(page, 'node-info-fields')).toHaveCount(1);
    await expect(fieldRow(page, 'remaining-fields')).toHaveCount(1);
    await expect(fieldRow(page, 'prot-ver')).toHaveCount(0); // ArtPollReply'de ProtVer YOK (dosya başı)
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('az bilinen OpCode (ArtTimeCode) adıyla tanınır, gövdesi ham + uyarı taşır', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('art-time-code-body-not-decoded');

    await expect(fieldRow(page, 'op-code').getByTestId('decode-field-physical')).toHaveText('ArtTimeCode');
    await expect(fieldRow(page, 'op-code')).toHaveAttribute('data-valid', 'true');
    await expect(fieldRow(page, 'body')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.artnet.warning.opcodeBodyNotDecoded'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan OpCode uyarı basar, alan geçersiz işaretlenir', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unknown-opcode');

    await expect(fieldRow(page, 'op-code')).toHaveAttribute('data-valid', 'false');
    await expect(fieldRow(page, 'op-code').getByTestId('decode-field-physical')).toHaveText('—');
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.artnet.warning.unrecognizedOpcode'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('bozuk imza (Art-Net değil) hata yolunu izler', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('invalid-signature');

    await expect(fieldRow(page, 'id')).toHaveAttribute('data-valid', 'false');
    await expect(fieldRow(page, 'op-code')).toHaveCount(0); // imza doğrulanmadan sonrası hiç okunmaz
    await expect(page.getByTestId('decode-frame-error')).toContainText(
      tr['protocol.artnet.error.invalidSignature'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('ArtDmx Length alanı tutarsızlığı hata değil uyarı basar', async ({ page }) => {
    await openDecodePanel(page, CANONICAL_DECODE_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('art-dmx-length-mismatch');

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.artnet.warning.lengthMismatch'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(CANONICAL_DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Art-Net');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('art-dmx-length-mismatch');
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      translations.en['protocol.artnet.warning.lengthMismatch'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, CANONICAL_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('art-dmx-full-512-universe');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
