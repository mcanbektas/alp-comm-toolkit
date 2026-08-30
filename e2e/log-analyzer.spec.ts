import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Log çözümleyicinin gerçek tarayıcı turu (spec §34).
 *
 * Birim testler jsdom'da koşar ve orada `Worker` YOKTUR — hook o ortamda ana
 * iş parçacığındaki yedek yola düşer. Yani Worker ayağı, Vite'ın Worker
 * chunk'ı ve `arrayBuffer()` ile dosya okuma yalnız BURADA sınanır. "Yeşil
 * birim test" bu ekranın tarayıcıda açıldığını kanıtlamaz.
 */

const tr = translations.tr;

const CANDUMP_LOG = [
  '(1637856000.100000) can0 123#DEADBEEF',
  '(1637856000.200000) can0 124#AABBCCDD',
  '(1637856000.300000) can1 123#0102',
  '(1637856000.400000) can1 18F00401#0102030405060708',
].join('\n');

async function openAnalyzer(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  // `/comm/` öneki ZORUNLU — bkz. smoke.spec.ts.
  await page.goto('/comm/log-analyzer');
  await expect(page.getByRole('heading', { level: 1, name: tr['logAnalyzer.title'] })).toBeVisible();
  return consoleErrors;
}

async function loadCandump(page: Page): Promise<void> {
  await page.getByTestId('log-file').setInputFiles({
    name: 'kayit.log',
    mimeType: 'text/plain',
    buffer: Buffer.from(CANDUMP_LOG, 'utf-8'),
  });
  await expect(page.getByTestId('log-record-count')).toHaveText('4');
}

test('candump logunu Worker üzerinden okur ve künyesini basar', async ({ page }) => {
  const consoleErrors = await openAnalyzer(page);
  await loadCandump(page);

  await expect(page.getByTestId('log-detected-format')).toContainText(tr['logAnalyzer.format.candump']);
  await expect(page.getByTestId('log-timeline')).toBeVisible();
  await expect(page.getByRole('grid', { name: tr['logAnalyzer.table.label'] })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('filtre listeyi daraltır ve sayaç bunu gösterir', async ({ page }) => {
  await openAnalyzer(page);
  await loadCandump(page);

  await page.getByTestId('log-filter-hex').fill('AABB');
  await expect(page.getByTestId('log-filter-result')).toContainText('1 / 4');

  await page.getByRole('button', { name: tr['logAnalyzer.filter.reset'] }).click();
  await expect(page.getByTestId('log-filter-result')).toContainText('4 / 4');
});

test('satır seçimi ayrıntı panelini açar ve baytları gösterir', async ({ page }) => {
  await openAnalyzer(page);
  await loadCandump(page);

  const table = page.getByRole('grid', { name: tr['logAnalyzer.table.label'] });
  await table.getByRole('row').first().click();

  await expect(page.getByTestId('log-detail-protocol')).toBeVisible();
  await expect(page.getByText(tr['logAnalyzer.detail.empty'])).toHaveCount(0);
});

test('PCAPNG dosyasında yönlendirici hata verir, ekran çökmez', async ({ page }) => {
  await openAnalyzer(page);

  await page.getByTestId('log-file').setInputFiles({
    name: 'yakalama.pcapng',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from([0x0a, 0x0d, 0x0d, 0x0a, 0, 0, 0, 0]),
  });

  await expect(page.getByTestId('log-error')).toContainText('PCAPNG');
  await expect(page.getByRole('heading', { level: 1, name: tr['logAnalyzer.title'] })).toBeVisible();
});
