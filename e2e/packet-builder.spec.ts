import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 7b'nin gerçek tarayıcı turu — Packet Builder.
 *
 * Buradaki asıl kanıt spec §10'un çerçevesi: form → kodlayıcı → checksum →
 * çerçeveleme zincirinin tamamı GERÇEK tarayıcıda koşup `AA 05 20 02 02 4B 6E 55`
 * üretmeli. Birim testler zinciri parça parça sınıyor; ekranın o parçaları
 * doğru bağladığını yalnız bu tur gösterir.
 *
 * Web Serial API headless Chromium'da yok. Hiçbir test seri porta bağlanmaz;
 * gönderim ayağı yalnız yazamayan `simulated` kaynakla sınanır.
 */

const tr = translations.tr;

/** §9.6 örnek şemasının veri adları — çeviriye girmez. */
const SAMPLE_SCHEMA_NAME = 'ALP Sensor Protocol';
const SAMPLE_SCHEMA_VERSION = '1.0';

/**
 * Spec §10'un paketi. Metinde checksum baytı `6C` yazar ve YANLIŞTIR:
 * XOR8(05 20 02 02 4B) = 0x6E. Fixture'ın (`specFixture.ts`) gerekçesi orada.
 */
const SPEC_PACKET_HEX = 'AA052002024B6E55';

async function openBuilder(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  // `/comm/` öneki ZORUNLU — bkz. smoke.spec.ts.
  await page.goto('/comm/packet-builder');
  await expect(page.getByRole('heading', { level: 1, name: tr['builder.title'] })).toBeVisible();
  return consoleErrors;
}

/** Üretilen paketin hex metni; `<output>` olduğu için değer değil metin okunur. */
function packetHex(page: Page) {
  return page.locator('#builder-preview-hex-value');
}

/** §10 örneğinin form girdisi: Set Output, kanal 2, %75 duty. */
async function fillSetOutputExample(page: Page): Promise<void> {
  await page.locator('#builder-field-address').fill('5');
  await page.locator('#builder-field-command').selectOption('32');
  await page.locator('#builder-field-payload').fill('024B');
}

test('paket kurucu açılır, başlık görünür ve konsola hata basmaz', async ({ page }) => {
  const consoleErrors = await openBuilder(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(tr['builder.title']);
  await expect(page.getByText(tr['builder.privacy'])).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('şema şeridi yüklü protokolü gösterir', async ({ page }) => {
  await openBuilder(page);

  await expect(page.getByTestId('builder-schema-missing')).toHaveCount(0);
  await expect(page.getByTestId('builder-schema-name')).toHaveText(SAMPLE_SCHEMA_NAME);
  await expect(page.getByTestId('builder-schema-version')).toHaveText(SAMPLE_SCHEMA_VERSION);
  await expect(page.getByTestId('builder-schema-error')).toHaveCount(0);
});

test('form alanları basılır ve türetilmiş alanlar salt-okunur gelir', async ({ page }) => {
  await openBuilder(page);

  // Kullanıcının doldurduğu üç alan gerçekten düzenlenebilir olmalı.
  await expect(page.locator('#builder-field-address')).toBeEditable();
  await expect(page.locator('#builder-field-command')).toBeEnabled();
  await expect(page.locator('#builder-field-payload')).toBeEditable();

  for (const path of ['payloadLength', 'checksum']) {
    // Türetilen alan `<output>` olarak basılır: düzenlenecek bir girdi YOKTUR.
    const control = page.locator(`#builder-field-${path}`);
    await expect(control).toHaveJSProperty('tagName', 'OUTPUT');
    await expect(page.getByTestId(`builder-field-${path}`).locator('input, select, textarea')).toHaveCount(0);
    await expect(page.getByTestId(`builder-derived-${path}`)).toHaveText(
      tr['builder.form.derivedBadge'],
    );
  }
});

test('form değeri değişince önizlemedeki paket hex de değişir', async ({ page }) => {
  await openBuilder(page);

  const before = await packetHex(page).innerText();
  expect(before).not.toBe('');

  await page.locator('#builder-field-address').fill('7');

  await expect(packetHex(page)).not.toHaveText(before);
  // Adres baytı ikinci sırada (başlangıç baytından sonra) ve 0x07 olmalı.
  await expect(packetHex(page)).toHaveText(/^AA07/);
});

test('spec §10 paketi birebir üretilir — checksum 6E, §10 metnindeki 6C değil', async ({ page }) => {
  await openBuilder(page);

  await fillSetOutputExample(page);

  await expect(packetHex(page)).toHaveText(SPEC_PACKET_HEX);
  await expect(page.getByTestId('builder-preview-byte-count')).toHaveText('8');
  await expect(page.getByTestId('builder-preview-issues')).toHaveCount(0);

  // Aynı baytlar §42/8 "adım adım" bölümünde de görünmeli: önizleme ile
  // gerçekten gönderilecek olan ayrışırsa test bunu yakalar. Bölüm katlanmış
  // geliyor, `<summary>`ye tıklayıp açıyoruz.
  await page.getByTestId('builder-doc-steps').locator('summary').click();
  await expect(page.locator('#builder-steps-framed-value')).toHaveText(SPEC_PACKET_HEX);

  // Checksum baytı: spec §10 `6C` yazar, XOR8(05 20 02 02 4B) = 0x6E.
  const checksumByte = SPEC_PACKET_HEX.slice(12, 14);
  expect(checksumByte).toBe('6E');
  await expect(packetHex(page)).not.toHaveText(/6C55$/);
});

test('simülasyon kaynağına bağlanınca yazamama uyarısı çıkar ve gönderim kapalı kalır', async ({
  page,
}) => {
  await openBuilder(page);

  // Varsayılan seçim zaten `simulated`; seri porta HİÇ dokunulmuyor.
  await expect(page.getByTestId('builder-source-simulated')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('builder-send')).toBeDisabled();
  await expect(page.getByTestId('builder-send-disabled')).toHaveText(tr['builder.send.disabledHint']);

  await page.getByTestId('builder-connect').click();

  await expect(page.getByTestId('builder-connection-status')).toHaveText(tr['builder.status.connected']);
  await expect(page.getByTestId('builder-cannot-write')).toHaveText(tr['builder.warning.readOnlySource']);
  // Yazamayan kaynak gönderimi açmamalı — uyarı basıp düğmeyi açmak daha kötü olurdu.
  await expect(page.getByTestId('builder-send')).toBeDisabled();

  await page.getByTestId('builder-disconnect').click();
  await expect(page.getByTestId('builder-connection-status')).toHaveText(
    tr['builder.status.disconnected'],
  );
});

/**
 * WebSocket kaynağı (spec §8.1) — GERÇEK köprüye bağlanır. Köprü
 * `playwright.config.ts`in ikinci `webServer`ıdır ve gönderileni yankılar,
 * yani tur yalnız bağlantıyı değil VERİ YOLUNU da ölçer.
 */
test('WebSocket köprüsüne bağlanır, paketi gönderir ve yankıyı gösterir', async ({ page }) => {
  const consoleErrors = await openBuilder(page);
  await fillSetOutputExample(page);
  await expect(packetHex(page)).toHaveText(SPEC_PACKET_HEX);

  await page.getByTestId('builder-source-websocket').click();
  await expect(page.getByTestId('builder-websocket-url')).toHaveValue('ws://localhost:8080');

  await page.getByTestId('builder-websocket-url').fill('ws://localhost:9099');
  await page.getByTestId('builder-connect').click();

  await expect(page.getByTestId('builder-connection-status')).toHaveText(tr['builder.status.connected']);

  await page.getByTestId('builder-send').click();
  // Köprü aynı baytları geri yollar: son yanıt üretilen paketin kendisidir.
  await expect(page.getByTestId('builder-last-response')).toHaveText(SPEC_PACKET_HEX);

  await page.getByTestId('builder-disconnect').click();
  await expect(page.getByTestId('builder-connection-status')).toHaveText(
    tr['builder.status.disconnected'],
  );
  expect(consoleErrors).toEqual([]);
});

test('ws:// olmayan adres bağlanmadan reddedilir', async ({ page }) => {
  await openBuilder(page);

  await page.getByTestId('builder-source-websocket').click();
  await page.getByTestId('builder-websocket-url').fill('http://localhost:9099');
  await page.getByTestId('builder-connect').click();

  await expect(page.getByTestId('builder-connection-status')).toHaveText(tr['builder.status.error']);
});

test('yatay taşma yok', async ({ page }) => {
  await openBuilder(page);
  await fillSetOutputExample(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, 'sayfa yatayda taşıyor').toBeLessThanOrEqual(0);
});

/**
 * Plugin encoder'ının EKRANDAKİ turu (spec §7).
 *
 * Bu iki testin birim testlerle sınanamayan kısmı şu: motor chunk'ı LAZY
 * yüklenir ve seçim ile bayt arasında bir `await` vardır. jsdom'da o yükleme
 * anında çözülür; gerçek tarayıcıda ayrı bir ağ isteğidir.
 */
test('plugin zarfı seçilince çerçeve HDLC bayrakları arasına alınır', async ({ page }) => {
  const consoleErrors = await openBuilder(page);

  await fillSetOutputExample(page);
  await expect(packetHex(page)).toHaveText(SPEC_PACKET_HEX);

  await page.locator('#builder-post-processing').selectOption('plugin:hdlc');

  // Ham çerçeve DEĞİŞMEZ; zarf onun üstüne biner (7E … FCS FCS 7E).
  await expect(packetHex(page)).toHaveText(/^7E.*7E$/);
  await expect(packetHex(page)).toContainText(SPEC_PACKET_HEX);
  await expect(page.getByTestId('builder-preview-byte-count')).toHaveText('12');
  expect(consoleErrors).toEqual([]);
});

test('sabitlenen encoder parametreleri ekranda uyarı olarak görünür', async ({ page }) => {
  await openBuilder(page);

  await page.locator('#builder-post-processing').selectOption('plugin:xmodem');

  await expect(page.getByTestId('builder-framing-fixed-note')).toHaveText(
    tr['builder.encoder.fixed.xmodem'],
  );

  // Yerleşik dala dönünce uyarı da düşer.
  await page.locator('#builder-post-processing').selectOption('none');
  await expect(page.getByTestId('builder-framing-fixed-note')).toHaveCount(0);
});

test('çerçeve kaynağı protokol encoder\'ına devredilince form o şemadan çizilir', async ({
  page,
}) => {
  const consoleErrors = await openBuilder(page);

  await page.locator('#builder-frame-source-select').selectOption('rf-telemetry-custom-frame');

  // Şema adı plugin'in kendi şemasından gelir.
  await expect(page.getByTestId('builder-schema-name')).toHaveText('RF Telemetry Custom Frame');
  await expect(page.getByTestId('builder-frame-source-note')).toBeVisible();

  // Tohum: encoder'ın kendi varsayılanları forma yazılır, boş bırakılıp EZİLMEZ.
  await expect(page.locator('#builder-field-preamble')).toHaveValue('AAAAAA');
  await expect(page.locator('#builder-field-syncWord')).toHaveValue('2DD4');
  await expect(packetHex(page)).toHaveText(/^AAAAAA2DD4/);

  await page.locator('#builder-frame-source-select').selectOption('schema');
  await expect(page.getByTestId('builder-schema-name')).toHaveText(SAMPLE_SCHEMA_NAME);
  expect(consoleErrors).toEqual([]);
});

/**
 * Modbus'un üç taşıyıcısı (spec §3.3): ekranda BİRER ZARF olarak durur ve
 * şemadan üretilen çerçevenin üstüne biner. TCP dalı seçildi çünkü çıktısının
 * tamamı — MBAP dahil — checksum hesabı olmadan yazılabilir; kayan tek şey
 * uzunluk alanıdır ve zaten sınanmak istenen de odur.
 */
test('Modbus TCP zarfı MBAP başlığını çerçevenin önüne yazar', async ({ page }) => {
  const consoleErrors = await openBuilder(page);

  await fillSetOutputExample(page);
  await expect(packetHex(page)).toHaveText(SPEC_PACKET_HEX);

  await page.locator('#builder-post-processing').selectOption('plugin:modbus-tcp');

  // transaction 0000 · protocol 0000 · length 0008 (unit ID dahil gövde) · gövde.
  await expect(packetHex(page)).toHaveText(`000000000008${SPEC_PACKET_HEX}`);
  await expect(page.getByTestId('builder-preview-byte-count')).toHaveText('14');

  // Sabitlenen transaction ID gizli bir varsayılan değil, ekranda yazılı bir kısıt.
  await expect(page.getByTestId('builder-framing-fixed-note')).toHaveText(
    tr['builder.encoder.fixed.modbusTcp'],
  );

  // RTU aynı gövdeyi CRC ile kapatır: gövde değişmez, iki bayt eklenir.
  await page.locator('#builder-post-processing').selectOption('plugin:modbus-rtu');
  await expect(packetHex(page)).toHaveText(new RegExp(`^${SPEC_PACKET_HEX}[0-9A-F]{4}$`));
  await expect(page.getByTestId('builder-preview-byte-count')).toHaveText('10');
  await expect(page.getByTestId('builder-framing-fixed-note')).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});

/**
 * §33'ün iki dönüşüm HEDEFİ ekranda (MQTT · CAN). İkisinin de kısıtı gerçek:
 * yükün belli bir yapıda olması gerekiyor ve §10 çerçevesi CAN'e uyup MQTT'ye
 * UYMUYOR — tur bu yüzden hem üretilen çerçeveyi hem reddedilen yolu ölçüyor.
 */
test('CAN 2.0B zarfı SocketCAN çerçevesi üretir, MQTT aynı yükü reddeder', async ({ page }) => {
  const consoleErrors = await openBuilder(page);

  await fillSetOutputExample(page);
  await expect(packetHex(page)).toHaveText(SPEC_PACKET_HEX);

  await page.locator('#builder-post-processing').selectOption('plugin:can-2-0b');

  // İlk dört bayt identifier sözcüğü (little-endian 0x022005AA), kalan dördü veri.
  // Encoder EFF bitini kendi yazar (0x82…), DLC'yi hesaplar, 16 bayta doldurur.
  await expect(packetHex(page)).toHaveText('AA05208204000000024B6E5500000000');
  await expect(page.getByTestId('builder-preview-byte-count')).toHaveText('16');
  await expect(page.getByTestId('builder-framing-fixed-note')).toHaveText(
    tr['builder.encoder.fixed.canExtended'],
  );

  // MQTT'de aynı yükün ilk iki baytı topic uzunluğu sayılır (0xAA05) ve gövdeye
  // sığmaz: paket ÜRETİLMEZ, kısıt sorun listesinde yazılı çıkar.
  await page.locator('#builder-post-processing').selectOption('plugin:mqtt');

  await expect(page.getByTestId('builder-preview-issues')).toContainText('encodeMqttPublishPacket');
  await expect(page.getByTestId('builder-preview-empty')).toBeVisible();

  // Kısıt sürprize dönüşmesin diye seçildiği anda ekranda önceden yazıyor.
  await expect(page.getByTestId('builder-framing-fixed-note')).toHaveText(
    tr['builder.encoder.fixed.mqtt'],
  );

  expect(consoleErrors).toEqual([]);
});

/**
 * J1939 ile NMEA 2000 listede AYRI iki zarftır ama AYNI encoder'ı paylaşır.
 * Ekranda sınanan şey ikisinin de kısıt notunu göstermesi ve reddedilen yolun
 * sessiz kalmaması: §10 çerçevesinin ilk baytı 0xAA, J1939 önceliği ise 3 bit.
 */
test('J1939 ve NMEA 2000 aynı kısıt notunu gösterir, geçersiz önceliği reddeder', async ({
  page,
}) => {
  const consoleErrors = await openBuilder(page);

  await fillSetOutputExample(page);

  await page.locator('#builder-post-processing').selectOption('plugin:j1939');
  await expect(page.getByTestId('builder-framing-fixed-note')).toHaveText(
    tr['builder.encoder.fixed.j1939'],
  );
  await expect(page.getByTestId('builder-preview-issues')).toContainText('encodeJ1939Identifier');
  await expect(page.getByTestId('builder-preview-empty')).toBeVisible();

  await page.locator('#builder-post-processing').selectOption('plugin:nmea-2000');
  await expect(page.getByTestId('builder-framing-fixed-note')).toHaveText(
    tr['builder.encoder.fixed.j1939'],
  );

  expect(consoleErrors).toEqual([]);
});

/**
 * BACnet'in iki taşıması, iki farklı uzunluk tuzağının üstünde: BVLC Length
 * KENDİNİ sayar, MS/TP Length yalnız VERİYİ sayar. Tur ikisini de ölçüyor.
 */
test('BACnet/IP ve MS/TP zarfları uzunluk alanlarını kendi kurallarıyla yazar', async ({ page }) => {
  const consoleErrors = await openBuilder(page);

  await fillSetOutputExample(page);
  await expect(packetHex(page)).toHaveText(SPEC_PACKET_HEX);

  await page.locator('#builder-post-processing').selectOption('plugin:bacnet-ip');

  // 81 0A + Length 000C: 4 başlık + 8 gövde = 12, yani başlık kendi içinde sayılı.
  await expect(packetHex(page)).toHaveText(`810A000C${SPEC_PACKET_HEX}`);
  await expect(page.getByTestId('builder-preview-byte-count')).toHaveText('12');

  await page.locator('#builder-post-processing').selectOption('plugin:bacnet-mstp');

  // 55 FF · Frame Type AA · hedef 05 · kaynak 20 · Length 0005 (YALNIZ veri) ·
  // Header CRC · 5 veri baytı · Data CRC. CRC'ler birim testte doğrulanıyor.
  await expect(packetHex(page)).toHaveText(/^55FFAA05200005[0-9A-F]{2}02024B6E55[0-9A-F]{4}$/);
  // 8 başlık + 5 veri + 2 Data CRC = 15; Length alanındaki 5 ile karıştırılmasın.
  await expect(page.getByTestId('builder-preview-byte-count')).toHaveText('15');
  await expect(page.getByTestId('builder-framing-fixed-note')).toHaveText(
    tr['builder.encoder.fixed.bacnetMstp'],
  );

  expect(consoleErrors).toEqual([]);
});
