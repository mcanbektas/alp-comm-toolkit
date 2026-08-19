import { test, expect } from '@playwright/test';

/**
 * LoRa PHY hesap araçları gerçek tarayıcıda (Faz 10, dalga 9a).
 *
 * Birim testler motoru zaten sınıyor; buradaki tek soru FORMUN motora bağlanıp
 * bağlanmadığı. `lora.test.ts`teki doğrulanmış fixture ekranda birebir görünmeli:
 * SF7/BW125/CR4-5, 20 bayt, 8 sembol preamble, explicit header, CRC açık → 56.576 ms.
 */

test('LoRa airtime aracı varsayılan girdide doğrulanmış ToA basar', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/comm/calculators/lora-airtime');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('LoRa');
  // Sembol süresi Ts = 2^7 / 125000 = 1.024 ms.
  await expect(page.getByText('1.024 ms', { exact: true })).toBeVisible();
  await expect(page.getByText('56.576 ms', { exact: true })).toBeVisible();
  // Duty cycle bölümü de aynı ToA'dan besleniyor: %1 sınırında 5.601 s sessizlik.
  await expect(page.getByText('5.601024 s', { exact: true })).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('KARAR 2 ekranda görünür: CRC kapatılınca ToA 51.456 ms’e düşer', async ({ page }) => {
  await page.goto('/comm/calculators/lora-airtime');

  await expect(page.getByText('56.576 ms', { exact: true })).toBeVisible();
  await page.getByLabel(/Payload CRC/i).uncheck();
  // Sabit `+16` varsayan hesaplayıcılarda bu sayı DEĞİŞMEZDİ — fark bilinçlidir.
  await expect(page.getByText('51.456 ms', { exact: true })).toBeVisible();
});

test('LoRa link bütçesi aracı duyarlılık tahminini ve yol kaybını basar', async ({ page }) => {
  await page.goto('/comm/calculators/lora-link-budget');

  // SF7/BW125/NF=6 → −174 + 50.97 + 6 − 7.5 = −124.53 dBm.
  await expect(page.getByText('-124.53 dBm', { exact: true })).toBeVisible();
  // ERP = 14 + 2 − 0.5 = 15.50 dBm, bütçe = 15.5 + 2 + 124.53 = 142.03 dB.
  await expect(page.getByText('15.50 dBm', { exact: true })).toBeVisible();
  await expect(page.getByText('142.03 dB', { exact: true })).toBeVisible();
});

test('hesap araçları listesinde iki LoRa kaydı gezinilebilir', async ({ page }) => {
  await page.goto('/comm/calculators');

  await expect(page.getByRole('link', { name: /LoRa Time on Air/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /LoRa link bütçesi/i })).toBeVisible();
});
