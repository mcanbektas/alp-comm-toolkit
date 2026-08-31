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
  // ÜÇ sunucu: uygulamanın derlenmiş çıktısı, WebSocket köprüsü ve MQTT broker'ı.
  webServer: [
    // Derlenmiş çıktıyı sınar, dev sunucusunu değil: kırılan şey üretimde de kırıktır.
    {
      command: 'npm run build && npm run preview -- --port 4319 --strictPort',
      url: 'http://localhost:4319',
      // Var olan sunucuyu ASLA yeniden kullanma. 4173 gibi yaygın bir portta başka bir
      // uygulama dinliyorsa Playwright sessizce ona bağlanır ve testler yanlış uygulamayı
      // ölçer — bir kez yaşandı, teşhisi pahalı.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    /**
     * WebSocket kaynağının (spec §8.1) gerçek tarayıcıda sınanabilmesi için
     * yankı köprüsü. Sahte soket birim testin işi; burada ölçülen şey gerçek
     * el sıkışma ve gerçek çerçeveler.
     */
    {
      command: 'node e2e/support/wsBridgeServer.mjs 9099',
      url: 'http://localhost:9099',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    /**
     * MQTT over WebSocket broker'ı (spec §33'ün "broker'a yayınla" ucu).
     * Yankı köprüsü YETMEZ: MQTT'de kanıt, karşı tarafın CONNECT'i ayrıştırıp
     * CONNACK üretmesidir — o olmadan istemci PUBLISH'i hiç göndermez. Stub
     * aldığı PUBLISH'leri `GET /published` altında açıyor, böylece tur ekranın
     * ne dediğine değil SUNUCUNUN NE ALDIĞINA bakabiliyor.
     */
    {
      command: 'node e2e/support/mqttBrokerServer.mjs 9098',
      url: 'http://localhost:9098',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
