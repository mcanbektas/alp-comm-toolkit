import { expect, test } from '@playwright/test';

import { buildSimulatedFrame } from '../src/connection/mock/simulatedProtocol';
import { translations } from '../src/translations';

/**
 * Faz 8'in gerçek tarayıcı turu. Birim testler Worker'ı ve React döngüsünü hiç
 * çalıştırmıyor — burası `streamParser.worker.ts`in ilk kez GERÇEKTEN koştuğu,
 * sanallaştırmanın gerçek düzenle ölçüldüğü ve spec §44'ün "UI thread
 * bloklanmaz" değişmezinin ölçülebildiği tek yer.
 */

const tr = translations.tr;

async function openMonitor(page: import('@playwright/test').Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    // Dil turu boyunca sabit kalsın; başlıklar çeviriye göre sorgulanıyor.
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });
  await page.goto('/comm/live-monitor');
  await expect(page.getByRole('heading', { level: 1, name: tr['monitor.title'] })).toBeVisible();
  return consoleErrors;
}

async function connectSimulated(
  page: import('@playwright/test').Page,
  framesPerSecond: number,
): Promise<void> {
  await page.getByLabel(tr['monitor.field.framesPerSecond']).selectOption(String(framesPerSecond));
  await page.getByRole('button', { name: tr['monitor.action.connect'] }).click();
  await expect(page.getByRole('button', { name: tr['monitor.action.disconnect'] })).toBeVisible();
}

/** Tabloya kaç kayıt girdiğini dilden bağımsız okur. */
async function recordCount(page: import('@playwright/test').Page): Promise<number> {
  const value = await page.getByRole('grid').getAttribute('aria-rowcount');
  return Number(value ?? '0');
}

test('monitör açılır ve simülasyon kaynağı canlı çerçeve üretir', async ({ page }) => {
  const consoleErrors = await openMonitor(page);

  await expect(page.getByText(tr['monitor.table.empty'])).toBeVisible();

  await connectSimulated(page, 200);

  // Worker gerçekten çerçeveliyorsa satır sayısı artar.
  await expect.poll(() => recordCount(page), { timeout: 10_000 }).toBeGreaterThan(50);

  // Çerçeveler doğrulanıyor: geçerli etiketi tabloda görünmeli.
  await expect(page.getByText(tr['monitor.validity.valid']).first()).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('istatistikler ve sinyal grafiği gerçek veriyle dolar', async ({ page }) => {
  const consoleErrors = await openMonitor(page);
  await connectSimulated(page, 1000);

  await expect.poll(() => recordCount(page), { timeout: 10_000 }).toBeGreaterThan(200);

  // İstatistik panelinde toplam çerçeve sıfırdan büyük olmalı.
  const totalFrames = page
    .locator('dt', { hasText: tr['monitor.stats.totalFrames'] })
    .locator('xpath=following-sibling::dd[1]');
  await expect
    .poll(async () => Number((await totalFrames.innerText()).replace(/\D/g, '')), {
      timeout: 10_000,
    })
    .toBeGreaterThan(100);

  // Grafik gerçekten çizgi bastı mı — boş bir SVG kabuğu yeterli değil.
  const chartPaths = page.locator('svg.recharts-surface path.recharts-curve');
  await expect.poll(async () => chartPaths.count(), { timeout: 10_000 }).toBeGreaterThan(0);

  // Sinyal istatistikleri tablosunda üç musluk da listelenmeli.
  await expect(page.getByRole('row', { name: /Temperature/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Voltage/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /RPM/ })).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('binlerce kayıtta bile DOM yalnız görünen satırları taşır', async ({ page }) => {
  await openMonitor(page);
  await connectSimulated(page, 5000);

  await expect.poll(() => recordCount(page), { timeout: 15_000 }).toBeGreaterThan(3000);

  const domRows = await page.getByRole('grid').getByRole('row').count();
  const records = await recordCount(page);

  // Sanallaştırma çalışıyorsa DOM satırı görünen pencere kadardır; kayıt
  // sayısıyla birlikte BÜYÜMEZ. Bu, spec §44'ün 100 bin satır hedefinin ölçüsü.
  expect(records).toBeGreaterThan(3000);
  expect(domRows).toBeLessThan(60);
});

test('yoğun akış altında UI thread bloklanmaz', async ({ page }) => {
  await openMonitor(page);
  await connectSimulated(page, 5000);
  await expect.poll(() => recordCount(page), { timeout: 15_000 }).toBeGreaterThan(1000);

  // Akış sürerken bir saniyede kaç kare çizilebiliyor. Ana thread ayrıştırma
  // yapsaydı ya da çerçeve başına setState çağrılsaydı bu sayı dibe vururdu.
  const framesInOneSecond = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let count = 0;
        const start = performance.now();
        const tick = (): void => {
          count += 1;
          if (performance.now() - start >= 1000) {
            resolve(count);
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      }),
  );

  // Headless Chromium 60 Hz'e sabitlenmez; eşik bilinçli olarak düşük ama
  // bloklanmış bir thread'i (tek haneli kare) yakalamaya yeter.
  expect(framesInOneSecond).toBeGreaterThan(20);
});

test('duraklat ekranı dondurur ama veri toplanmaya devam eder', async ({ page }) => {
  await openMonitor(page);
  await connectSimulated(page, 1000);
  await expect.poll(() => recordCount(page), { timeout: 10_000 }).toBeGreaterThan(100);

  await page.getByRole('button', { name: tr['monitor.action.pause'] }).click();
  await expect(page.getByText(tr['monitor.action.pausedNotice'])).toBeVisible();

  const frozen = await recordCount(page);
  await page.waitForTimeout(700);
  expect(await recordCount(page)).toBe(frozen);

  await page.getByRole('button', { name: tr['monitor.action.resume'] }).click();

  // Sürdürünce duraklatma boyunca gelen çerçeveler de tabloda olmalı.
  await expect.poll(() => recordCount(page), { timeout: 5000 }).toBeGreaterThan(frozen);
});

test('kayıtlar temizlenebilir ve bağlantı kesilebilir', async ({ page }) => {
  await openMonitor(page);
  await connectSimulated(page, 1000);
  await expect.poll(() => recordCount(page), { timeout: 10_000 }).toBeGreaterThan(100);

  await page.getByRole('button', { name: tr['monitor.action.disconnect'] }).click();
  await expect(page.getByRole('button', { name: tr['monitor.action.connect'] })).toBeVisible();

  await page.getByRole('button', { name: tr['monitor.action.clear'] }).click();

  await expect.poll(() => recordCount(page), { timeout: 5000 }).toBe(0);
  await expect(page.getByText(tr['monitor.table.empty'])).toBeVisible();
});

test('görüntüleme kipi değişince baytlar yeniden biçimlenir', async ({ page }) => {
  await openMonitor(page);
  await connectSimulated(page, 200);
  await expect.poll(() => recordCount(page), { timeout: 10_000 }).toBeGreaterThan(20);

  await page.getByRole('button', { name: tr['monitor.action.pause'] }).click();

  const firstRow = page.getByRole('grid').getByRole('row').first();
  const hexText = await firstRow.innerText();
  expect(hexText).toMatch(/[0-9A-F]{2} [0-9A-F]{2}/);

  await page.getByRole('button', { name: tr['monitor.action.resume'] }).click();
  await page.getByLabel(tr['monitor.field.displayMode']).selectOption('binary');
  await page.getByRole('button', { name: tr['monitor.action.pause'] }).click();

  await expect
    .poll(async () => (await page.getByRole('grid').getByRole('row').first().innerText()))
    .toMatch(/[01]{8}/);
});

test('zaman damgaları geriye gitmez — hata satırları da sırada durur', async ({ page }) => {
  await openMonitor(page);
  // Çöp bayt üreten akış: tabloda hem çerçeve hem çerçeveleme hatası olsun.
  await connectSimulated(page, 1000);
  await expect.poll(() => recordCount(page), { timeout: 10_000 }).toBeGreaterThan(300);
  await page.getByRole('button', { name: tr['monitor.action.pause'] }).click();

  const stamps = await page
    .getByRole('grid')
    .getByRole('row')
    .evaluateAll((rows) =>
      rows
        .map((row) => row.querySelector('span')?.textContent?.trim() ?? '')
        .filter((text) => /^\d{2}:\d{2}:\d{2}\./.test(text)),
    );

  expect(stamps.length).toBeGreaterThan(5);
  // Damgalar Worker'da atıldığı için üretim sırası korunur; ana thread'de
  // atılsaydı toplu boşaltma hata satırlarını ileri kaydırırdı.
  const sorted = [...stamps].sort();
  expect(stamps).toEqual(sorted);
});

test('360 pikselde yatay kaydırma yok', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 720 });
  await openMonitor(page);
  await connectSimulated(page, 200);
  await expect.poll(() => recordCount(page), { timeout: 10_000 }).toBeGreaterThan(20);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

/**
 * Dosya oynatma kaynağının gerçek tarayıcı turu (spec §8.1).
 *
 * Burada iki Worker birden koşar: log dosyası `logAnalyzer.worker.ts`te
 * ayrıştırılır, çıkan kayıtlar `streamParser.worker.ts`e beslenir. jsdom'da
 * `Worker` olmadığı için birim testler bu zinciri hiç kurmuyor.
 */
const CANDUMP_REPLAY_LOG = [
  '(1637856000.100000) can0 123#DEADBEEF',
  '(1637856000.140000) can0 124#AABBCCDD',
  '(1637856000.180000) can1 123#0102',
  '(1637856000.220000) can1 18F00401#0102030405060708',
].join('\n');

test('dosya oynatma kaynağı logu canlı zincire besler', async ({ page }) => {
  const consoleErrors = await openMonitor(page);

  await page.getByRole('button', { name: tr['monitor.source.file'] }).click();
  // Kayıt sınırını çerçeve sınırı yapan hazır ayar.
  await page
    .getByLabel(tr['monitor.field.framing'])
    .selectOption({ label: tr['monitor.framing.recordReplay'] });

  await page.getByTestId('monitor-file').setInputFiles({
    name: 'kayit.log',
    mimeType: 'text/plain',
    buffer: Buffer.from(CANDUMP_REPLAY_LOG, 'utf-8'),
  });
  await expect(page.getByTestId('monitor-file-summary')).toContainText('4');

  await page.getByRole('button', { name: tr['monitor.action.connect'] }).click();
  await expect(page.getByRole('button', { name: tr['monitor.action.disconnect'] })).toBeVisible();

  // Dört kayıt dört çerçeve olmalı: kayıt sınırı çerçeve sınırıdır.
  await expect.poll(() => recordCount(page), { timeout: 10_000 }).toBe(4);
  await expect(page.getByTestId('monitor-file-finished')).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('dosya seçilmeden bağlanmaya çalışmak uyarı verir', async ({ page }) => {
  await openMonitor(page);

  await page.getByRole('button', { name: tr['monitor.source.file'] }).click();
  await page.getByRole('button', { name: tr['monitor.action.connect'] }).click();

  await expect(page.getByTestId('monitor-file-error')).toHaveText(tr['monitor.file.needsFile']);
  await expect(page.getByRole('button', { name: tr['monitor.action.connect'] })).toBeVisible();
});

/**
 * WebSocket kaynağı (spec §8.1) — monitör yalnız DİNLER, o yüzden köprü İTME
 * kipinde çalışıyor (`?push=<hex>`). Baytlar simülasyon protokolünün gerçek
 * çerçevesidir: hex'i test kurmuyor, `buildSimulatedFrame` üretiyor — elle
 * yazılmış bir çerçeve, çerçeveleme ayarıyla sessizce ayrışabilirdi.
 */
test('WebSocket köprüsünden gelen çerçeveler tabloda görünür', async ({ page }) => {
  const consoleErrors = await openMonitor(page);

  const frame = buildSimulatedFrame({ temperatureDeciC: 250, voltageMilliV: 12000, rpm: 1500 });
  const hex = Array.from(frame, (byte) => byte.toString(16).padStart(2, '0')).join('');

  await page.getByTestId('monitor-source-websocket').click();
  await page.getByTestId('monitor-websocket-url').fill(`ws://localhost:9099/?push=${hex}&interval=50`);
  await page.getByRole('button', { name: tr['monitor.action.connect'] }).click();

  await expect(page.getByRole('button', { name: tr['monitor.action.disconnect'] })).toBeVisible();
  await expect.poll(() => recordCount(page), { timeout: 10_000 }).toBeGreaterThan(3);
  // Çerçeve gerçekten çözülüyor: köprüden gelen bayt da doğrulanmış çerçeve olur.
  await expect(page.getByText(tr['monitor.validity.valid']).first()).toBeVisible();

  await page.getByRole('button', { name: tr['monitor.action.disconnect'] }).click();
  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});
