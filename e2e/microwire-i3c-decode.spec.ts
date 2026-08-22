import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 11 (#11) gerçek tarayıcı turu — Microwire + I3C.
 *
 * Bu dalganın asıl yeniliği `decode` sekmesindeki SEÇENEK FORMU: çerçeveden
 * çıkarılamayan parametreler artık kullanıcıdan alınıyor. Birim testler
 * seçeneği fonksiyona doğrudan geçirebiliyor; formun gerçekten basıldığını,
 * değiştirildiğinde ÇÖZÜMÜN değiştiğini ve seçenek bildirmeyen 171 sayfada
 * formun HİÇ görünmediğini yalnız tarayıcı turu kanıtlar.
 *
 * Ayrıca kanıtladıkları: iki sayfanın da Hazır rozetiyle açıldığı; Microwire'da
 * yürürlükteki profilin kaynak belgesiyle basıldığı; I3C'de ENTDAA cihaz
 * tablosunun iki hedefi de açtığı; IBI belirsizliğinin uyarı olarak göründüğü;
 * iki dilde de ham çeviri anahtarı sızmadığı.
 */

const tr = translations.tr;
const en = translations.en;

const MICROWIRE_DECODE = '/comm/interfaces-framing/peripheral-buses/microwire?tab=decode';
const I3C_DECODE = '/comm/interfaces-framing/peripheral-buses/i3c?tab=decode';
/** Seçenek bildirmeyen bir kayıt — formun yalnız bildirene basıldığının kanıtı. */
const I2C_DECODE = '/comm/interfaces-framing/peripheral-buses/i2c?tab=decode';
const MICROWIRE_CALC = '/comm/calculators/microwire-transaction';

async function openDecodePanel(page: Page, path: string, language = 'tr'): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript((lang: string) => {
    window.localStorage.setItem('alp-comm-lang', lang);
  }, language);

  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

test.describe('Seçenek formu — paylaşılan kanal', () => {
  test('seçenek bildirmeyen sayfada form HİÇ görünmez', async ({ page }) => {
    await openDecodePanel(page, I2C_DECODE);
    await expect(page.getByTestId('decode-options')).toHaveCount(0);
  });

  test('bildiren sayfada form açıklamasıyla birlikte görünür', async ({ page }) => {
    await openDecodePanel(page, MICROWIRE_DECODE);

    await expect(page.getByTestId('decode-options')).toBeVisible();
    await expect(page.getByTestId('decode-options-hint')).toHaveText(tr['decode.options.hint']);
    await expect(page.getByText(tr['decode.options.legend'], { exact: true })).toBeVisible();
  });
});

test.describe('Microwire', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, MICROWIRE_DECODE);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Microwire');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'microwire');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('READ örneği komut/adres/veri alanlarını ve KAYNAK BELGESİNİ basar', async ({ page }) => {
    await openDecodePanel(page, MICROWIRE_DECODE);
    await page.getByLabel(tr['decode.example.label']).selectOption('read-word');

    await expect(fieldRow(page, 'opcode').getByTestId('decode-field-physical')).toHaveText('READ');
    await expect(fieldRow(page, 'address').getByTestId('decode-field-physical')).toHaveText('0x0A');
    await expect(fieldRow(page, 'data').getByTestId('decode-field-physical')).toHaveText('0xBEEF');
    // Hangi sayılarla çözüldüğü ve o sayıların NEREDEN geldiği ekranda.
    await expect(fieldRow(page, 'profile').getByTestId('decode-field-physical')).toHaveText(
      'Microchip DS20001749K Table 1-3',
    );
  });

  test('PROFİL DEĞİŞİNCE aynı baytlar başka bir transaction olur', async ({ page }) => {
    await openDecodePanel(page, MICROWIRE_DECODE);
    await page.getByLabel(tr['decode.example.label']).selectOption('read-word');

    await expect(fieldRow(page, 'address').getByTestId('decode-field-physical')).toHaveText('0x0A');

    await page.getByLabel(tr['protocol.microwire.option.profile']).selectOption('93xx46-x8');

    // x8 profilinde adres 7 bit, veri 8 bit — çözüm gerçekten değişir.
    await expect(fieldRow(page, 'address').getByTestId('decode-field-physical')).toHaveText('0x15');
    await expect(fieldRow(page, 'data').getByTestId('decode-field-physical')).toHaveText('0x7D');
  });

  test('serbest profilde üç sayı doğrudan uygulanır', async ({ page }) => {
    await openDecodePanel(page, MICROWIRE_DECODE);
    await page.getByLabel(tr['decode.example.label']).selectOption('read-word');
    await page.getByLabel(tr['protocol.microwire.option.profile']).selectOption('custom');

    await page.getByLabel(tr['protocol.microwire.option.wordBits']).fill('8');

    await expect(fieldRow(page, 'data').getByTestId('decode-field-raw')).toHaveText('0b10111110');
  });

  test('EWEN örneğinde adres BASILMAZ — don\'t-care biti adres diye gösterilmez', async ({
    page,
  }) => {
    await openDecodePanel(page, MICROWIRE_DECODE);
    await page.getByLabel(tr['decode.example.label']).selectOption('ewen');

    await expect(fieldRow(page, 'opcode').getByTestId('decode-field-physical')).toHaveText('EWEN');
    await expect(fieldRow(page, 'data')).toHaveCount(0);
  });

});

test.describe('Microwire hesaplayıcısı', () => {
  test('93xx46 x16 READ 25 clock, 1 MHz SK ile 25 µs', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(MICROWIRE_CALC);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.getByText('25', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('25.00 µs', { exact: true })).toBeVisible();
    // Kaynak belgesi hesaplayıcıda da görünür.
    await expect(page.getByText('Microchip DS20001749K Table 1-3', { exact: true })).toBeVisible();
  });

  test('ERASE veri sözcüğü taşımaz ve 9 clock sürer', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(MICROWIRE_CALC);

    await page.getByLabel(tr['calc.field.microwireCommand']).selectOption('ERASE');

    await expect(page.getByText('9', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(tr['common.no'], { exact: true })).toBeVisible();
  });
});

test.describe('I3C', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, I3C_DECODE);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('I3C');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'i3c');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('ENTDAA örneği İKİ hedefi de PID/BCR/DCR/atanan adres olarak açar', async ({ page }) => {
    await openDecodePanel(page, I3C_DECODE);
    await page.getByLabel(tr['decode.example.label']).selectOption('entdaa');

    await expect(fieldRow(page, 'pid-0').getByTestId('decode-field-raw')).toHaveText(
      '0x123456789ABC',
    );
    await expect(fieldRow(page, 'assignedAddress-0').getByTestId('decode-field-physical')).toHaveText(
      'DA 0x08',
    );
    await expect(fieldRow(page, 'pid-1').getByTestId('decode-field-raw')).toHaveText(
      '0x00A112334455',
    );
    await expect(fieldRow(page, 'assignedAddress-1').getByTestId('decode-field-physical')).toHaveText(
      'DA 0x09',
    );
    await expect(fieldRow(page, 'dcr-0').getByTestId('decode-field-physical')).toHaveText(
      'Generic Device',
    );
  });

  test('parite VARSAYIMI uyarı olarak ekranda görünür — gizlenmez', async ({ page }) => {
    await openDecodePanel(page, I3C_DECODE);
    await page.getByLabel(tr['decode.example.label']).selectOption('entdaa');

    await expect(page.getByText(tr['protocol.i3c.warning.daaParityAssumed'])).toBeVisible();
  });

  test('Direct GETBCR: hedef adresi ve BCR yetenek bitleri basılır', async ({ page }) => {
    await openDecodePanel(page, I3C_DECODE);
    await page.getByLabel(tr['decode.example.label']).selectOption('direct-getbcr');

    await expect(fieldRow(page, 'ccc').getByTestId('decode-field-physical')).toHaveText(
      'GETBCR · Direct',
    );
    await expect(fieldRow(page, 'targetAddress').getByTestId('decode-field-physical')).toContainText(
      '7-bit 0x08',
    );
    await expect(fieldRow(page, 'bcr').getByTestId('decode-field-physical')).toContainText('HDR');
  });

  test('IBI belirsizliği otomatikte uyarı basar, tür seçilince MDB adlanır', async ({ page }) => {
    await openDecodePanel(page, I3C_DECODE);
    await page.getByLabel(tr['decode.example.label']).selectOption('ibi');

    // Otomatik: ayrım baytlarda yok, uyarı görünür ve MDB satırı YOK.
    await expect(page.getByText(tr['protocol.i3c.warning.ibiAmbiguous'])).toBeVisible();
    await expect(fieldRow(page, 'mdb')).toHaveCount(0);

    await page.getByLabel(tr['protocol.i3c.option.frameKind']).selectOption('ibi');

    await expect(fieldRow(page, 'mdb').getByTestId('decode-field-raw')).toHaveText('0x40');
    await expect(page.getByText(tr['protocol.i3c.warning.ibiAmbiguous'])).toHaveCount(0);
  });

  test('İngilizcede ham çeviri anahtarı sızmaz', async ({ page }) => {
    await openDecodePanel(page, I3C_DECODE, 'en');
    await page.getByLabel(en['decode.example.label']).selectOption('entdaa');

    await expect(page.getByTestId('decode-options-hint')).toHaveText(en['decode.options.hint']);
    await expect(page.getByText(en['protocol.i3c.warning.daaParityAssumed'])).toBeVisible();
    // `protocol.i3c.` öneki ekranda GÖRÜNMEMELİ — çevrilmemiş anahtarın imzası.
    await expect(page.locator('body')).not.toContainText('protocol.i3c.');
  });
});

test.describe('Yatay taşma', () => {
  /**
   * Seçenek formu 4 sütunlu bir ızgara — dar ekranda taşma riski gerçek ve
   * yalnız burada yakalanır. Depodaki her decode spec'inin son testiyle aynı
   * biçim.
   */
  for (const [name, path, example] of [
    ['Microwire', MICROWIRE_DECODE, 'read-word'],
    ['I3C', I3C_DECODE, 'entdaa'],
  ] as const) {
    test(`${name}: 1440 ve 390 pikselde yatay taşma yok`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openDecodePanel(page, path);
      await page.getByLabel(tr['decode.example.label']).selectOption(example);
      await expect(page.getByTestId('decode-field-table')).toBeVisible();

      const wide = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

      await page.setViewportSize({ width: 390, height: 844 });
      const narrow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
    });
  }
});
