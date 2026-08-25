import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 15g'nin gerçek tarayıcı turu — MIL-STD-1553.
 *
 * Kanıtladığı şeyler: sayfa Hazır rozetiyle açılıyor ve `live` sekmesi YOK;
 * `wordByteOrder` seçilmeden yalnız ham 2 bayt basılıyor; `wordType`
 * seçilmeden 16 bit ham + uyarı görünüyor; tip seçilince alan tablosu
 * DEĞİŞİYOR ve AYNI 2 bayt üç tipte ÜÇ FARKLI tablo veriyor; mode code ADI ve
 * ICD engineering değeri hiçbir yerde basılmıyor.
 *
 * ── 15e'nin dersi burada da geçerli ────────────────────────────────────────
 * *"Bir `decodeOptions` seçeneğinin sınırı `DecodePanel`in doğrulamasından
 * geçemiyordu; birim test `parse()`i doğrudan çağırdığı için yeşildi, hata
 * yalnız tarayıcıda göründü."* Bu kayıtta sayısal seçenek YOK (ikisi de
 * `select`), ama aynı disiplinle HER İKİ seçeneğin HER şıkkı tarayıcıda
 * gerçekten deneniyor — panelin ürettiği `<select>`in `value`su motora
 * ulaşmıyorsa alan tablosu değişmez ve test kırılır.
 */

const tr = translations.tr;

const MIL1553_DECODE_PATH = '/comm/aerospace-uav/avionics-data-buses/mil-std-1553?tab=decode';

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

/**
 * Tuzak (12d/12e + 15f): alan uyarısı AYRI bir `<tr>`de basılır ve bir alanın
 * birden çok uyarısı varsa seçici birden çok `<li>`ye çözülür — metin süzgeci
 * şart.
 */
function fieldWarning(page: Page, fieldId: string, text?: string): Locator {
  const all = page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
  return text === undefined ? all : all.filter({ hasText: text });
}

function frameWarning(page: Page, text: string): Locator {
  // Tuzak: birden çok çerçeve uyarısı aynı anda basılır — `.filter({hasText})` şart.
  return page.locator('[data-testid="decode-frame-warning"]').filter({ hasText: text });
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.getByLabel(tr['decode.example.label']).selectOption(exampleId);
}

async function setOption(page: Page, labelKey: keyof typeof tr, value: string): Promise<void> {
  await page.getByLabel(tr[labelKey]).selectOption(value);
}

async function setByteOrder(page: Page, value: string): Promise<void> {
  await setOption(page, 'protocol.mil1553.option.wordByteOrder', value);
}

async function setWordType(page: Page, value: string): Promise<void> {
  await setOption(page, 'protocol.mil1553.option.wordType', value);
}

test.describe('MIL-STD-1553', () => {
  test('decode sekmesi Hazır rozetiyle açılır, `live` sekmesi YOK, konsola hata basmaz', async ({
    page,
  }) => {
    const consoleErrors = await openDecodePanel(page, MIL1553_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('MIL-STD-1553');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute(
      'data-plugin-id',
      'mil-std-1553',
    );
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
    // Katalog `live`i hiç açmamıştı — analog Manchester yakalama yok.
    await expect(page.getByRole('tab', { name: tr['tab.live'] })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: tr['tab.decode'] })).toBeVisible();

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('parite uyarısı KOŞULSUZ görünür — bit girdide yok ve doğrulanmıyor', async ({ page }) => {
    await openDecodePanel(page, MIL1553_DECODE_PATH);
    await selectExample(page, 'command-word-rt3-transmit');
    await expect(frameWarning(page, tr['protocol.mil1553.warning.parityNotInInput'])).toBeVisible();
  });

  test('wordByteOrder SEÇİLMEDEN yalnız ham 2 bayt basılır', async ({ page }) => {
    await openDecodePanel(page, MIL1553_DECODE_PATH);
    await selectExample(page, 'command-word-rt3-transmit');

    await expect(fieldRow(page, 'mil1553-word-0-raw')).toBeVisible();
    await expect(fieldRow(page, 'mil1553-word-0-rt-address')).toHaveCount(0);
    await expect(
      frameWarning(page, tr['protocol.mil1553.warning.wordByteOrderNotSelected']),
    ).toBeVisible();
    // Bir sayı basmak bir bayt sırası seçmektir — panel em-dash gösterir.
    await expect(fieldRow(page, 'mil1553-word-0-raw').getByTestId('decode-field-raw')).toHaveText(
      '—',
    );
  });

  test('wordType SEÇİLMEDEN 16 bit HAM + uyarı, alt alan ADLANDIRILMAZ', async ({ page }) => {
    await openDecodePanel(page, MIL1553_DECODE_PATH);
    await selectExample(page, 'command-word-rt3-transmit');
    await setByteOrder(page, 'big-endian');

    const raw = fieldRow(page, 'mil1553-word-0-raw');
    await expect(raw).toBeVisible();
    await expect(raw).toContainText('type unknown');
    // `decode-field-raw` sayıyı `0x1C21 (7201)` biçiminde basar (tuzak listesi).
    await expect(raw.getByTestId('decode-field-raw')).toContainText('7201');
    await expect(raw.getByTestId('decode-field-physical')).toHaveText('0001110000100001');
    await expect(
      frameWarning(page, tr['protocol.mil1553.warning.wordTypeUnknown']),
    ).toBeVisible();
    await expect(
      fieldWarning(page, 'mil1553-word-0-raw', tr['protocol.mil1553.field.wordTypeUnknown']),
    ).toBeVisible();

    // Hiçbir alt alan yok.
    await expect(fieldRow(page, 'mil1553-word-0-rt-address')).toHaveCount(0);
    await expect(fieldRow(page, 'mil1553-word-0-message-error')).toHaveCount(0);
    await expect(fieldRow(page, 'mil1553-word-0-data')).toHaveCount(0);
  });

  test('AYNI 2 bayt, üç tipte ÜÇ FARKLI alan tablosu — seçenek gerçekten bağlı', async ({
    page,
  }) => {
    await openDecodePanel(page, MIL1553_DECODE_PATH);
    await selectExample(page, 'command-word-rt3-transmit');
    await setByteOrder(page, 'big-endian');

    // (a) Command: RT Address · T/R · Subaddress · Word Count.
    await setWordType(page, 'command');
    await expect(fieldRow(page, 'mil1553-word-0-rt-address')).toContainText(
      'Command · RT Address (bit 15:11)',
    );
    await expect(
      fieldRow(page, 'mil1553-word-0-transmit-receive').getByTestId('decode-field-physical'),
    ).toHaveText('Transmit (RT → bus)');
    await expect(
      fieldRow(page, 'mil1553-word-0-word-count').getByTestId('decode-field-raw'),
    ).toContainText('1');
    await expect(fieldRow(page, 'mil1553-word-0-message-error')).toHaveCount(0);
    await expect(fieldRow(page, 'mil1553-word-0-data')).toHaveCount(0);

    // (b) Status: AYNI bit 10 artık Message Error. Sessiz yanlış adlandırmanın somut hâli.
    await setWordType(page, 'status');
    await expect(fieldRow(page, 'mil1553-word-0-rt-address')).toContainText(
      'Status · RT Address (bit 15:11)',
    );
    await expect(
      fieldRow(page, 'mil1553-word-0-message-error').getByTestId('decode-field-physical'),
    ).toHaveText('SET');
    await expect(fieldRow(page, 'mil1553-word-0-terminal-flag')).toBeVisible();
    await expect(fieldRow(page, 'mil1553-word-0-transmit-receive')).toHaveCount(0);
    await expect(fieldRow(page, 'mil1553-word-0-word-count')).toHaveCount(0);

    // (c) Data: TEK bir ham alan.
    await setWordType(page, 'data');
    await expect(fieldRow(page, 'mil1553-word-0-data')).toContainText('Data (bit 15:0)');
    await expect(fieldRow(page, 'mil1553-word-0-rt-address')).toHaveCount(0);
    await expect(fieldRow(page, 'mil1553-word-0-message-error')).toHaveCount(0);
    await expect(
      fieldWarning(page, 'mil1553-word-0-data', tr['protocol.mil1553.field.dataMeaningRequiresIcd']),
    ).toBeVisible();
  });

  test('wordByteOrder de GERÇEKTEN bağlı — ters sıra bambaşka değerler verir', async ({ page }) => {
    await openDecodePanel(page, MIL1553_DECODE_PATH);
    await selectExample(page, 'command-word-rt3-transmit');
    await setWordType(page, 'command');

    await setByteOrder(page, 'big-endian');
    await expect(
      fieldRow(page, 'mil1553-word-0-rt-address').getByTestId('decode-field-raw'),
    ).toContainText('3');

    // Hata YOK, değer FARKLI — `bitCursor.ts:22`nin uyardığı sınıf.
    await setByteOrder(page, 'little-endian');
    await expect(
      fieldRow(page, 'mil1553-word-0-rt-address').getByTestId('decode-field-raw'),
    ).toContainText('4');
    await expect(
      fieldRow(page, 'mil1553-word-0-word-count').getByTestId('decode-field-raw'),
    ).toContainText('28');
  });

  test('Status Word: dokuz bayrak ve rezerve bitler — çalışılmış örnekte hepsi temiz', async ({
    page,
  }) => {
    await openDecodePanel(page, MIL1553_DECODE_PATH);
    await selectExample(page, 'status-word-rt3-all-clear');
    await setByteOrder(page, 'big-endian');
    await setWordType(page, 'status');

    await expect(
      fieldRow(page, 'mil1553-word-0-rt-address').getByTestId('decode-field-raw'),
    ).toContainText('3');
    await expect(
      fieldRow(page, 'mil1553-word-0-reserved').getByTestId('decode-field-physical'),
    ).toHaveText('000');
    for (const suffix of ['message-error', 'busy', 'subsystem-flag', 'terminal-flag']) {
      await expect(
        fieldRow(page, `mil1553-word-0-${suffix}`).getByTestId('decode-field-physical'),
        suffix,
      ).toHaveText('CLEAR');
    }
    await expect(
      frameWarning(page, tr['protocol.mil1553.warning.statusReservedBitsNotZero']),
    ).toHaveCount(0);
  });

  test('rezerve bitler sıfır değilse uyarı çıkar — yanlış wordType göstergesi', async ({ page }) => {
    await openDecodePanel(page, MIL1553_DECODE_PATH);
    await selectExample(page, 'status-word-reserved-not-zero');
    await setByteOrder(page, 'big-endian');
    await setWordType(page, 'status');

    await expect(
      fieldRow(page, 'mil1553-word-0-reserved').getByTestId('decode-field-physical'),
    ).toHaveText('111');
    await expect(
      fieldWarning(page, 'mil1553-word-0-reserved', tr['protocol.mil1553.field.reservedBitsNotZero']),
    ).toBeVisible();
    await expect(
      frameWarning(page, tr['protocol.mil1553.warning.statusReservedBitsNotZero']),
    ).toBeVisible();
    // Yine de bir HATA değil — kısmi çözüm gösterilmeye devam ediyor.
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
  });

  test('mode command: alan Word Count DEĞİL Mode Code, ve kodun ADI BASILMAZ', async ({ page }) => {
    await openDecodePanel(page, MIL1553_DECODE_PATH);
    await selectExample(page, 'mode-command-subaddress-31');
    await setByteOrder(page, 'big-endian');
    await setWordType(page, 'command');

    await expect(
      fieldRow(page, 'mil1553-word-0-subaddress').getByTestId('decode-field-physical'),
    ).toHaveText('Mode command');
    const mode = fieldRow(page, 'mil1553-word-0-mode-code');
    await expect(mode).toContainText('Command · Mode Code (bit 4:0)');
    await expect(mode.getByTestId('decode-field-raw')).toContainText('2');
    // ADI YOK — panel `physicalValue` verilmediği için em-dash basar.
    await expect(mode.getByTestId('decode-field-physical')).toHaveText('—');
    await expect(mode).not.toContainText('Synchronize');
    await expect(mode).not.toContainText('Transmitter Shutdown');
    await expect(
      fieldWarning(
        page,
        'mil1553-word-0-mode-code',
        tr['protocol.mil1553.field.modeCodeNameRequiresRevision'],
      ),
    ).toBeVisible();
    await expect(fieldRow(page, 'mil1553-word-0-word-count')).toHaveCount(0);
  });

  test('broadcast: RT 31 adlandırılır, subaddress 0 DA mode command sayılır', async ({ page }) => {
    await openDecodePanel(page, MIL1553_DECODE_PATH);
    await selectExample(page, 'broadcast-mode-command-subaddress-0');
    await setByteOrder(page, 'big-endian');
    await setWordType(page, 'command');

    await expect(
      fieldRow(page, 'mil1553-word-0-rt-address').getByTestId('decode-field-physical'),
    ).toHaveText('Broadcast (31)');
    await expect(
      fieldRow(page, 'mil1553-word-0-subaddress').getByTestId('decode-field-physical'),
    ).toHaveText('Mode command');
    await expect(fieldRow(page, 'mil1553-word-0-mode-code')).toBeVisible();
  });

  test('üç sözcüklük işlem: alan kimlikleri indeks taşır ve tip UYARISI çıkar', async ({ page }) => {
    await openDecodePanel(page, MIL1553_DECODE_PATH);
    await selectExample(page, 'three-word-transaction');
    await setByteOrder(page, 'big-endian');
    await setWordType(page, 'data');

    await expect(fieldRow(page, 'mil1553-word-0-data')).toBeVisible();
    await expect(fieldRow(page, 'mil1553-word-1-data')).toBeVisible();
    await expect(fieldRow(page, 'mil1553-word-2-data').getByTestId('decode-field-raw')).toContainText(
      '2',
    );
    await expect(
      frameWarning(page, tr['protocol.mil1553.warning.wordTypeAppliedToAllWords']),
    ).toBeVisible();
  });

  test('sözcük hizasız girdi decode-parse-error basar', async ({ page }) => {
    await openDecodePanel(page, MIL1553_DECODE_PATH);
    await selectExample(page, 'not-word-aligned');
    // Tuzak: `success:false` `decode-parse-error` kartı basar, `decode-frame-error` DEĞİL.
    await expect(page.getByTestId('decode-parse-error')).toBeVisible();
    await expect(page.getByTestId('decode-parse-error')).toContainText(
      tr['protocol.mil1553.error.notWordAligned'],
    );
  });
});
