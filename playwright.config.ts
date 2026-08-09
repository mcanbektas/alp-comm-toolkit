import { defineConfig, devices } from '@playwright/test';

/**
 * Duman testi (smoke). Birim testler jsdom'da koşar ve CSS'i hiç değerlendirmez —
 * yani "yeşil test" ekranın gerçekten açıldığını kanıtlamaz. Burası gerçek tarayıcıda
 * layout, token'lar ve rotaların ayakta olduğunu doğrulayan tek yer.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:4319',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Derlenmiş çıktıyı sınar, dev sunucusunu değil: kırılan şey üretimde de kırıktır.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4319 --strictPort',
    url: 'http://localhost:4319',
    // Var olan sunucuyu ASLA yeniden kullanma. 4173 gibi yaygın bir portta başka bir
    // uygulama dinliyorsa Playwright sessizce ona bağlanır ve testler yanlış uygulamayı
    // ölçer — bir kez yaşandı, teşhisi pahalı.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
