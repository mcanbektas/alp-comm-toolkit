import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
  SAMPLE_LDF_ALIGNED_FRAME,
  SAMPLE_LDF_FRAME_COUNT,
  SAMPLE_LDF_SCHEDULE_TABLE_COUNT,
  SAMPLE_LDF_SIGNAL_COUNT,
  SAMPLE_LDF_UNALIGNED_FRAME,
  SAMPLE_LIN13_LDF_TEXT,
} from '../src/protocol-core/definitions/ldf/ldfFixture';
import { translations } from '../src/translations/all';

/**
 * LDF (LIN Description File) tanım panelinin gerçek tarayıcı turu.
 *
 * Kanıtladığı şey: `lin` kaydının `definitions` sekmesi artık "planlandı"
 * bildirimi DEĞİL, gerçek bir üretici dosyasının çerçeve/sinyal/çizelge
 * tablosunu basıyor; her çerçevenin checksum modeli DOSYADAN çözülüyor
 * (`lin.ts`in "telden okunamaz" notunun öteki yarısı); ve yakalanmış bir veri
 * alanı bu tanıma göre sinyallere BÖLÜNÜYOR.
 *
 * Desen `gsd-definitions.spec.ts`ten.
 *
 * ── ⚠ BU DALGA DOKUZ E2E BEKÇİSİNİ GEÇERSİZ KILDI — NE YAPILDI ──────────────
 * LDF, spec §6'nın son tanım biçimiydi. Paneli gelince `DefinitionFormat`ın
 * on iki üyesinin HEPSİNİN karşılığı oldu ve `ProtocolPage`in "planlandı"
 * yedek dalına GERÇEK katalog verisiyle ULAŞILAMAZ hâle geldi.
 *
 * Dokuz tanım turu (`dbc` · `eds` · `schema` · `vendor-map` · `a2l` ·
 * `xml-device` · `dsdl` · `xif` · `gsd`) `lin`i "motoru olmayan biçim" örneği
 * olarak kullanıyordu ve "planlandı bildirimi GÖRÜNÜR" diyordu. Yerine
 * BAŞKA bir motorsuz biçim koymak İMKÂNSIZ — kalmadı. Üç seçenek vardı:
 *
 *   (a) Bekçileri SİLMEK. Reddedildi: iddianın YARISI hâlâ değerli ve hâlâ
 *       doğru — "benim panelim, biçimimi saymayan bir kayıtta AÇILMAMALI".
 *   (b) Sahte bir katalog kaydı uydurmak. Reddedildi:
 *       `src/pages/ProtocolPage.test.tsx`in giriş notu "kataloğu taklit etmek
 *       zincirin kendisini taklit etmektir" diyor ve e2e'de bu daha da ağır
 *       olurdu (gerçek tarayıcı turunun tek anlamı GERÇEK veriyle koşması).
 *   (c) Bekçiyi DAHA GÜÇLÜ bir iddiaya çevirmek. **Seçilen bu.** Dokuzu da
 *       artık `lin`de "benim panelim açılmaz VE kaydın kendi biçiminin paneli
 *       (LDF) açılır" diyor — yani panelin biçime göre SEÇİLDİĞİNİ kanıtlıyor.
 *       Eskisi bir YOKLUK ölçüyordu, yenisi DOĞRU EŞLEŞMEYİ.
 *
 * Erişilemez hâle gelen "planlandı" yedek dalı `ProtocolPage.test.tsx`te İKİ
 * birim testiyle kapsandı: biri kapsam değişmezini KATALOGDAN ölçüyor (her
 * kullanılan biçimin paneli var mı — dokuz e2e bekçisinin toplamından geniş),
 * öteki `resolveDefinitionPanel`i saf işlev olarak sınayıp `undefined`
 * dönebildiğini gösteriyor. Yeni bir biçim panelsiz eklendiği gün birinci test
 * kırılır ve e2e bekçisi geri getirilebilir.
 */

const tr = translations.tr;

const DEFINITIONS_PATH = '/comm/automotive/vehicle-network-protocols/lin?tab=definitions';
/**
 * Bu turun kendi "başka biçim" bekçisi — dokuzunun aynadaki görüntüsü.
 * PROFIBUS DP yalnız `gsd` sayar, o yüzden burada LDF paneli AÇILMAMALI.
 */
const NON_LDF_DEFINITIONS_PATH =
  '/comm/industrial-automation/classic-fieldbus/profibus-dp?tab=definitions';

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

async function openLdfPanel(page: Page, path: string = DEFINITIONS_PATH): Promise<string[]> {
  const consoleErrors = await openPage(page, path);
  await expect(page.getByTestId('ldf-panel')).toBeVisible();
  return consoleErrors;
}

function frameRow(page: Page, name: string): Locator {
  return page.locator(`[data-testid="ldf-frame-row"][data-frame-name="${name}"]`);
}

function decodedRow(page: Page, name: string): Locator {
  return page.locator(`[data-testid="ldf-decoded-row"][data-signal-name="${name}"]`);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** Hiçbir satır ham çeviri anahtarı basmamalı (dalga 1'de görülen kusur). */
async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  const panelText = (await page.getByTestId('ldf-panel').innerText()).trim();
  expect(panelText, 'panel ham çeviri anahtarı basıyor').not.toMatch(/definition\.ldf\./);
  for (const metin of await page.getByTestId('ldf-issue').allTextContents()) {
    expect(metin.trim(), 'ldf-issue çevrilmemiş anahtar basıyor').not.toMatch(
      /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
    );
  }
}

test('definitions sekmesi LDF paneliyle açılır ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openLdfPanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('LIN');
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
  await expect(page.getByTestId('ldf-load-failed')).toHaveCount(0);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('ekran BOŞ açılmaz: gerçek üretici dosyası yüklü gelir ve özetini basar', async ({ page }) => {
  await openLdfPanel(page);

  await expect(page.getByTestId('ldf-sample-notice')).toBeVisible();
  await expect(page.getByTestId('ldf-protocol-version')).toHaveText('2.2');
  await expect(page.getByTestId('ldf-language-version')).toHaveText('2.2');
  await expect(page.getByTestId('ldf-speed')).toHaveText('19.2');
  await expect(page.getByTestId('ldf-master')).toHaveText('SeatECU');
  await expect(page.getByTestId('ldf-time-base')).toHaveText('5');
  await expect(page.getByTestId('ldf-jitter')).toHaveText('0.1');
  await expect(page.getByTestId('ldf-slaves')).toHaveText('Motor1, Motor2');
  await expect(page.getByTestId('ldf-frame-count')).toHaveText(String(SAMPLE_LDF_FRAME_COUNT));
  await expect(page.getByTestId('ldf-signal-count')).toHaveText(String(SAMPLE_LDF_SIGNAL_COUNT));

  await expectNoRawTranslationKeys(page);
});

test('çerçeve tablosu kimliği KORUMALI KİMLİĞE çevirir', async ({ page }) => {
  await openLdfPanel(page);

  await expect(page.getByTestId('ldf-frame-row')).toHaveCount(SAMPLE_LDF_FRAME_COUNT);

  // Kimlik 51 (0x33) → eşlik bitleri P0=1, P1=0 → PID 0x73. Telde taşınan budur.
  const cyclic = frameRow(page, SAMPLE_LDF_UNALIGNED_FRAME);
  await expect(cyclic.getByTestId('ldf-frame-protected-id')).toHaveText('0x73');
  await expect(cyclic.getByTestId('ldf-frame-length')).toHaveText('6');
  await expect(cyclic).toContainText('Motor1');

  // Ayrılmış teşhis kimliklerinin PID'leri spec'in kendi bilinen değerleri.
  await expect(frameRow(page, 'MasterReq').getByTestId('ldf-frame-protected-id')).toHaveText('0x3C');
  await expect(frameRow(page, 'SlaveResp').getByTestId('ldf-frame-protected-id')).toHaveText('0x7D');

  await expectNoRawTranslationKeys(page);
});

test('checksum modeli DOSYADAN çözülür ve gerekçesi KOŞULSUZ yazılır', async ({ page }) => {
  await openLdfPanel(page);

  await expect(page.getByTestId('ldf-checksum-note')).toBeVisible();
  await expect(page.getByTestId('ldf-checksum-note')).toHaveText(tr['definition.ldf.checksumNote']);

  // LIN 2.2 bildiren slave yayınlıyor → geliştirilmiş, gerekçesi düğümle birlikte.
  const cyclic = frameRow(page, SAMPLE_LDF_UNALIGNED_FRAME).getByTestId('ldf-frame-checksum');
  await expect(cyclic).toContainText(tr['definition.ldf.checksum.enhanced']);
  await expect(cyclic).toContainText(tr['definition.ldf.checksum.reason.linTwoSlave']);
  await expect(cyclic).toContainText('Motor1');

  // Ayrılmış teşhis kimliği → KOŞULSUZ klasik (spec 2.3.1.5).
  const master = frameRow(page, 'MasterReq').getByTestId('ldf-frame-checksum');
  await expect(master).toContainText(tr['definition.ldf.checksum.classic']);
  await expect(master).toContainText(tr['definition.ldf.checksum.reason.reservedDiagnostic']);
});

test('yakalanan veri alanı bu tanıma göre sinyallere BÖLÜNÜR', async ({ page }) => {
  await openLdfPanel(page);

  await expect(page.getByTestId('ldf-decode-tool')).toBeVisible();
  // Açılış çerçevesi `frames[0]` DEĞİL: teşhis çerçeveleri dışlanıp en çok
  // sinyal taşıyan seçilir (`chooseDefaultLdfFrame`). `frames[0]` bu dosyada
  // 1 sinyalli `Motor1_Dynamic`e düşüyordu.
  await expect(page.getByTestId('ldf-decode-frame')).toHaveValue(SAMPLE_LDF_UNALIGNED_FRAME);
  // Örnek baytlar UYDURULMADI: dosyanın kendi `init_value`larından paketlendi.
  // `Motor1Temp: 7, 5` → 7 bit @ ofset 0 = 5; kalan sinyallerin başlangıcı 0.
  await expect(page.getByTestId('ldf-decode-hex')).toHaveValue('05 00 00 00 00 00');
  await expect(page.getByTestId('ldf-hex-error')).toHaveCount(0);

  // encTemperature: physical 0-80, scale 0.5, offset -20 → 0.5 × 5 − 20 = −17.5.
  const temperature = decodedRow(page, 'Motor1Temp');
  await expect(temperature.getByTestId('ldf-decoded-raw')).toHaveText('5');
  await expect(temperature.getByTestId('ldf-decoded-physical')).toHaveText('-17.5 Degree');

  const flag = decodedRow(page, 'Motor1LinError');
  await expect(flag.getByTestId('ldf-decoded-raw')).toHaveText('0');

  // Elle yazılan hex geçerli olmalı ve ÜZERİNE yazabilmeli.
  await page.getByTestId('ldf-decode-hex').fill('41 02 03 04 05 01');
  await expect(temperature.getByTestId('ldf-decoded-raw')).toHaveText('65');
  await expect(temperature.getByTestId('ldf-decoded-physical')).toHaveText('12.5 Degree');

  await expect(page.getByTestId('ldf-decode-scope-note')).toBeVisible();
  await expectNoRawTranslationKeys(page);
});

test('örnek veri SEÇİLİ ÇERÇEVEYİ izler — sabit bir hex değil', async ({ page }) => {
  await openLdfPanel(page);

  // 1 baytlık çerçeveye geçince örnek veri de 1 bayta iner (`Motor1_Dynamic`in
  // tek sinyali `Motor1_Dynamic_Sig: 8, 7` → 0x07).
  await page.getByTestId('ldf-decode-frame').selectOption('Motor1_Dynamic');
  await expect(page.getByTestId('ldf-decode-hex')).toHaveValue('07');
  await expect(decodedRow(page, 'Motor1_Dynamic_Sig').getByTestId('ldf-decoded-raw')).toHaveText('7');

  // Elle yazılan değer, çerçeve değişince ASILI KALMAZ.
  await page.getByTestId('ldf-decode-hex').fill('FF');
  await page.getByTestId('ldf-decode-frame').selectOption(SAMPLE_LDF_ALIGNED_FRAME);
  await expect(page.getByTestId('ldf-decode-hex')).toHaveValue('00 00 00 00 00 00');
  await expect(page.getByTestId('ldf-hex-error')).toHaveCount(0);
});

test('HİZASIZ bayt dizisinde okuma UYDURULMAZ — üreticinin kendi kusuru', async ({ page }) => {
  await openLdfPanel(page);

  // `Motor1Temp` 7 bit olduğu için `Motor1Position` bit 7'den başlıyor; spec
  // 2.2.3 her baytın tek bir çerçeve baytına oturmasını istiyor.
  const unaligned = decodedRow(page, 'Motor1Position');
  await expect(unaligned.getByTestId('ldf-decoded-raw')).toHaveText(
    tr['definition.ldf.decode.unaligned'],
  );

  // Gerçek, değiştirilmemiş dosyanın TEK uyarısı bu ve dosyanın kendi kusuru.
  await expect(page.getByTestId('ldf-issue')).toHaveCount(1);
  await expect(page.getByTestId('ldf-issue')).toContainText('Motor1Position');
  await expectNoRawTranslationKeys(page);
});

test('KARDEŞ çerçevede aynı yerleşim HİZALI ve baytlar okunur', async ({ page }) => {
  await openLdfPanel(page);

  await page.getByTestId('ldf-decode-frame').selectOption(SAMPLE_LDF_ALIGNED_FRAME);
  await page.getByTestId('ldf-decode-hex').fill('02 0A 0B 0C 0D 01');

  // `Motor2Temp` 8 bit, o yüzden `Motor2Position` bit 8'den başlıyor: KURALA UYGUN.
  const aligned = decodedRow(page, 'Motor2Position');
  await expect(aligned.getByTestId('ldf-decoded-raw')).toHaveText('0x0A 0x0B 0x0C 0x0D');

  // 0.5 × 2 − 20 = −19.
  await expect(decodedRow(page, 'Motor2Temp').getByTestId('ldf-decoded-physical')).toHaveText(
    '-19 Degree',
  );
});

test('geçersiz hex ÖNCEKİ tabloyu silmez, hata mesajı basar', async ({ page }) => {
  await openLdfPanel(page);

  await page.getByTestId('ldf-decode-hex').fill('ZZ');

  await expect(page.getByTestId('ldf-hex-error')).toBeVisible();
  await expect(page.getByTestId('ldf-hex-error')).toHaveText(tr['decode.error.invalidHex']);
  // Çerçeve tablosu AYAKTA kalır.
  await expect(page.getByTestId('ldf-frame-row')).toHaveCount(SAMPLE_LDF_FRAME_COUNT);
});

test('sinyal, düğüm ve çizelge tabloları dosyadan gelir', async ({ page }) => {
  await openLdfPanel(page);

  await expect(page.getByTestId('ldf-signal-row')).toHaveCount(SAMPLE_LDF_SIGNAL_COUNT);
  const byteArray = page.locator('[data-testid="ldf-signal-row"][data-signal-name="Motor1Position"]');
  await expect(byteArray.getByTestId('ldf-signal-kind')).toHaveText(
    tr['definition.ldf.signalKind.byteArray'],
  );
  const scalar = page.locator('[data-testid="ldf-signal-row"][data-signal-name="Motor2Temp"]');
  await expect(scalar.getByTestId('ldf-signal-kind')).toHaveText(
    tr['definition.ldf.signalKind.scalar'],
  );

  await expect(page.getByTestId('ldf-node-row')).toHaveCount(2);
  const motor1 = page.locator('[data-testid="ldf-node-row"][data-node-name="Motor1"]');
  await expect(motor1.getByTestId('ldf-node-protocol')).toHaveText('2.2');
  await expect(motor1).toContainText('0x02');
  await expect(motor1).toContainText('MotorControl');

  await expect(page.getByTestId('ldf-schedule-row')).toHaveCount(SAMPLE_LDF_SCHEDULE_TABLE_COUNT);
  const normal = page.locator('[data-testid="ldf-schedule-row"][data-schedule-name="NormalTable"]');
  await expect(normal.getByTestId('ldf-schedule-cycle')).toHaveText('150');
  // Düğüm yapılandırma komutu argümanlarıyla birlikte basılır.
  const init = page.locator('[data-testid="ldf-schedule-row"][data-schedule-name="InitTable"]');
  await expect(init).toContainText('AssignFrameId');
  await expect(init).toContainText('Motor1, Motor1State_Cycl');

  await expectNoRawTranslationKeys(page);
});

test('LIN 1.3 lehçeli GERÇEK dosya içe aktarılınca panel hata basmaz', async ({ page }) => {
  await openLdfPanel(page);

  await page.getByTestId('ldf-import').setInputFiles({
    name: 'lin13.ldf',
    mimeType: 'text/plain',
    buffer: Buffer.from(SAMPLE_LIN13_LDF_TEXT, 'utf8'),
  });

  await expect(page.getByTestId('ldf-protocol-version')).toHaveText('1.3');
  await expect(page.getByTestId('ldf-master')).toHaveText('CEM');
  await expect(page.getByTestId('ldf-frame-count')).toHaveText('7');

  // `Node_attributes` bölümü LIN 1.3'te YOKTUR: boş tablo yerine açıklama +
  // 1.3'ün kendi teşhis adresleri basılır.
  await expect(page.getByTestId('ldf-node-table')).toHaveCount(0);
  await expect(page.getByTestId('ldf-no-node-attributes')).toBeVisible();
  await expect(page.getByTestId('ldf-no-node-attributes')).toContainText('LSM = 0x01');

  // `Signal_groups` yalnız bu lehçede var.
  await expect(page.getByTestId('ldf-signal-groups')).toContainText('CPMReq (64 bit)');

  // Düğüm özniteliği yokken checksum kümenin kendi sürümünden çözülür: 1.3 → klasik.
  const frame = frameRow(page, 'VL1_CEM_Frm1').getByTestId('ldf-frame-checksum');
  await expect(frame).toContainText(tr['definition.ldf.checksum.classic']);
  await expect(frame).toContainText(tr['definition.ldf.checksum.reason.clusterVersion']);

  // Boy alanı yazılmamış beş çerçeve UYARIR, uzunluk UYDURULMAZ.
  await expect(page.getByTestId('ldf-issue')).toHaveCount(5);
  await expect(page.getByTestId('ldf-issue-list')).toContainText('VL1_CEM_Frm2');
  await expect(frameRow(page, 'VL1_CEM_Frm2').getByTestId('ldf-frame-length')).toHaveText('—');

  // İçe aktarma örnek veriyi de YENİ kümeye göre yeniden türetir; eski
  // dosyanın baytları yeni çerçeveye karşı asılı kalmaz.
  await expect(page.getByTestId('ldf-decode-frame')).toHaveValue('VL1_LSM_Frm1');
  await expect(page.getByTestId('ldf-decode-hex')).toHaveValue('00 00 00 00');

  await expect(page.getByTestId('ldf-import-error')).toHaveCount(0);
  await expect(page.getByTestId('ldf-load-failed')).toHaveCount(0);
  await expect(page.getByTestId('ldf-sample-notice')).toHaveCount(0);
  await expectNoRawTranslationKeys(page);
});

test('bozuk dosya ÖNCEKİ tabloyu silmez, hata mesajı basar', async ({ page }) => {
  await openLdfPanel(page);

  await page.getByTestId('ldf-import').setInputFiles({
    name: 'broken.ldf',
    mimeType: 'text/plain',
    buffer: Buffer.from('bu bir LDF dosyasi degil\n', 'utf8'),
  });

  const importError = page.getByTestId('ldf-import-error');
  await expect(importError).toBeVisible();
  await expect(importError).toHaveText(tr['definition.ldf.error.parseFailed']);
  // Önceki küme AYAKTA kalır.
  await expect(page.getByTestId('ldf-frame-row')).toHaveCount(SAMPLE_LDF_FRAME_COUNT);
  await expect(page.getByTestId('ldf-issue-list')).toContainText(tr['definition.ldf.issue.notLdf']);
  await expectNoRawTranslationKeys(page);
});

test('LDF saymayan protokolde panel AÇILMAZ, o kaydın KENDİ paneli açılır', async ({ page }) => {
  await openPage(page, NON_LDF_DEFINITIONS_PATH);

  // Dokuz kardeş bekçinin aynadaki görüntüsü: PROFIBUS DP yalnız `gsd` sayıyor.
  await expect(page.getByTestId('ldf-panel')).toHaveCount(0);
  await expect(page.getByTestId('gsd-panel')).toBeVisible();
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLdfPanel(page);
  await expect(page.getByTestId('ldf-frame-table')).toBeVisible();
  expect(
    await horizontalOverflow(page),
    'sayfa 1440px genişlikte yatayda taşıyor',
  ).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('ldf-frame-table')).toBeVisible();
  expect(
    await horizontalOverflow(page),
    'sayfa 390px genişlikte yatayda taşıyor',
  ).toBeLessThanOrEqual(0);
});
