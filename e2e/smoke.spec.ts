import { test, expect } from '@playwright/test';

/**
 * Faz 2 iskeletinin gerçekten AÇILDIĞINI kanıtlar. jsdom testleri CSS'i hiç
 * değerlendirmediği için "92 test yeşil" boş bir sayfayı da yeşil gösterir;
 * buradaki kontroller (token rengi gerçekten uygulanmış mı, yatay kaydırma var mı)
 * yalnız gerçek tarayıcıda anlamlıdır.
 */

test('ana sayfa açılır ve 8 alan kartı basar', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('172', { exact: false }).first()).toBeVisible();

  // Sekiz domain kartı — katalog gerçekten bağlanmış mı.
  const domainLinks = page.getByRole('main').getByRole('link');
  expect(await domainLinks.count()).toBeGreaterThanOrEqual(8);

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('token rengi uygulanmış — sayfa çıplak beyaz değil', async ({ page }) => {
  await page.goto('/');
  const background = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  // Koyu tema varsayılan; token yüklenmemişse jsdom gibi şeffaf/beyaz kalırdı.
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  expect(background).not.toBe('rgb(255, 255, 255)');
});

test('protokol sayfasına derin bağlantı çalışır ve ByteViewer çizer', async ({ page }) => {
  // `/comm/` öneki ZORUNLU: `vite.config.ts` base'i `/comm/` yapıyor, preview
  // sunucusu kök altındaki derin yolları SPA'ya düşürmeden 404 veriyor. Önek
  // olmadan test uygulamayı hiç yüklemeden düşer.
  await page.goto('/comm/interfaces-framing/framing-stream-protocols/custom-binary-protocol?tab=decode');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Custom Binary Protocol');
  // ByteViewer örnek çerçeveyi (AA 05 10 03 34 12 7F 4F 55) HEX olarak basmalı.
  await expect(page.getByText('AA', { exact: true }).first()).toBeVisible();
});

test('bilinmeyen rota 404 sayfası basar, patlamaz', async ({ page }) => {
  await page.goto('/comm/boyle-bir-alan-yok');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link').first()).toBeVisible();
});

test('360px genişlikte yatay kaydırma yok', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'sayfa yatayda taşıyor').toBeLessThanOrEqual(1);
});
