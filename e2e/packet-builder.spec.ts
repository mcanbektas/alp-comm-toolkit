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

test('WebSocket seçeneği listede var ama devre dışı ve planlandı rozetli', async ({ page }) => {
  await openBuilder(page);

  const websocket = page.getByTestId('builder-source-websocket');
  await expect(websocket).toBeVisible();
  await expect(websocket).toHaveText(tr['builder.source.websocket']);
  await expect(websocket).toBeDisabled();
  await expect(page.getByTestId('builder-source-websocket-badge')).toHaveText(
    tr['builder.source.plannedBadge'],
  );

  // §42/10 sınırlar bölümü de aynı şeyi yazmalı: rozet ile belge ayrışmasın.
  await expect(page.getByTestId('builder-limit-websocket')).toHaveText(
    tr['builder.doc.limits.websocket'],
  );
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
