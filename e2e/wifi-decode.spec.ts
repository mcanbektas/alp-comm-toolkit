import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 18a'nın gerçek tarayıcı turu — Wi-Fi (IEEE 802.11) MAC katmanı,
 * `wireless-iot`in (deponun SON domain'inin) ilk alt dalgası.
 *
 * Motor birim testlerde alan alan doğrulandı; bu dosya motoru değil,
 * **kapsam kararının ve üç sessiz-yanlış noktasının EKRANDA görünür
 * olduğunu** sınar:
 *   · rozet "Kısmi" ve özet neyin ÇÖZÜLDÜĞÜNÜ / ÇÖZÜLMEDİĞİNİ açıkça yazıyor mu,
 *   · gerçek Beacon'ın dört alanı (FC alt alanları, ROLLERİYLE adresler,
 *     SeqCtl, FCS PASS) görünüyor mu,
 *   · ACK 14 baytta Address 2 ve Sequence Control satırlarını BASMIYOR mu,
 *   · korumalı veri çerçevesi gövdeyi ŞİFRELİ damgasıyla bırakıyor mu,
 *   · bozuk-FCS örneği FAIL basıyor mu,
 *   · adres rol matrisi gösterimi kanalla değişiyor mu,
 *   · `timing` sekmesi "planlandı" basıyor mu (airtime hesapları kapsam dışı).
 * Desen `lonworks-decode.spec.ts` (17) ve `iec-61162-decode.spec.ts`ten (16c).
 */

const tr = translations.tr;
const DECODE_PATH = '/comm/wireless-iot/wifi-wireless/wifi?tab=decode';
const TIMING_PATH = '/comm/wireless-iot/wifi-wireless/wifi?tab=timing';

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

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors = await openPage(page, DECODE_PATH);
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

/** Alan uyarısı AYRI bir `<tr>`dedir — satırın içinden değil KÖKTEN aranır. */
function fieldWarning(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

/** Çerçeve uyarısı birden çok olduğu için strict-mode ihlaline düşmemek adına süzülür. */
function frameWarning(page: Page, text: string): Locator {
  return page.getByTestId('decode-frame-warning').filter({ hasText: text });
}

async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.locator('#decode-example').selectOption(exampleId);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** Çeviri anahtarının ham hâlde ekrana düşmesi sessiz bir eksik anahtar demektir. */
async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const text of await page.getByTestId(testId).allTextContents()) {
      expect(text.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test('sayfa Kısmi rozetiyle açılır, özet kapsam çizgisini AÇIKÇA yazar, konsola hata basmaz', async ({
  page,
}) => {
  const consoleErrors = await openDecodePanel(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wi-Fi');
  await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'wifi');
  await expect(page.getByTestId('decode-plugin-name')).toHaveText('Wi-Fi');
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();
  await expect(page.getByText(tr['status.planned'], { exact: true })).toHaveCount(0);
  await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

  // Katalog özeti (protokol VERİSİDİR, çevrilmez) çözüleni, henüz
  // çözülmeyeni ve KAPSAM DIŞI olanı AYRI AYRI sayar.
  const summary = page.locator('p', { hasText: 'OUT OF SCOPE' }).first();
  await expect(summary).toContainText('DECODED');
  await expect(summary).toContainText('NOT DECODED YET');
  await expect(summary).toContainText('radiotap');

  await expect(page.locator('#decode-hex')).toHaveValue(/^80 00 00 00 FF FF FF FF FF FF 00 0C 41/);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('gerçek Beacon: FC alt alanları, ROLLERİYLE adresler, SeqCtl ve FCS PASS ekranda', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(fieldRow(page, 'fc-type').getByTestId('decode-field-physical')).toHaveText(
    'management',
  );
  await expect(fieldRow(page, 'fc-subtype').getByTestId('decode-field-physical')).toHaveText(
    'Beacon',
  );
  await expect(fieldRow(page, 'fc-protected').getByTestId('decode-field-physical')).toHaveText(
    'plaintext body',
  );

  // 🚨 Adres rol matrisi: "Address 1 = hedef" VARSAYILMIYOR, ÇÖZÜLÜYOR.
  await expect(fieldRow(page, 'address-1')).toContainText('Address 1 · DA');
  await expect(fieldRow(page, 'address-2')).toContainText('Address 2 · SA');
  await expect(fieldRow(page, 'address-3')).toContainText('Address 3 · BSSID');
  await expect(fieldRow(page, 'address-1').getByTestId('decode-field-physical')).toContainText(
    'broadcast',
  );
  // OUI etiketi IEEE kaydından; sözlük DAR ve kapatılabilir.
  await expect(fieldRow(page, 'address-2').getByTestId('decode-field-physical')).toContainText(
    'Cisco-Linksys',
  );

  // Sequence Control tek 16 bitlik LE sayıdır, sonra maskelenir.
  await expect(fieldRow(page, 'sequence-number').getByTestId('decode-field-physical')).toHaveText(
    '3973',
  );
  await expect(fieldRow(page, 'fragment-number').getByTestId('decode-field-physical')).toHaveText(
    '0',
  );

  await expect(fieldRow(page, 'fcs').getByTestId('decode-field-physical')).toHaveText(
    'PASS (covers 140 B)',
  );
  await expect(fieldRow(page, 'fcs')).toHaveAttribute('data-valid', 'true');
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);

  // 🚨 Gövde ARTIK ÇÖZÜLÜYOR (18b): tek parça ham `body` satırı KALMADI.
  await expect(fieldRow(page, 'body')).toHaveCount(0);
  await expect(frameWarning(page, tr['protocol.wifi.warning.bodyNotDecoded'])).toHaveCount(0);
});

test('ACK 14 baytta çözülür: Address 2 ve Sequence Control satırları HİÇ BASILMAZ', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'ack');

  await expect(fieldRow(page, 'fc-subtype').getByTestId('decode-field-physical')).toHaveText('ACK');
  await expect(fieldRow(page, 'address-1')).toHaveCount(1);
  // Ofset zincirinin en sert sınavı: bu iki satır YOKTUR.
  await expect(fieldRow(page, 'address-2')).toHaveCount(0);
  await expect(fieldRow(page, 'sequence-number')).toHaveCount(0);
  await expect(fieldRow(page, 'fragment-number')).toHaveCount(0);
  // Gövde de yok — boş bir "Frame Body" satırı basılmıyor.
  await expect(fieldRow(page, 'body')).toHaveCount(0);
  await expect(fieldRow(page, 'fcs').getByTestId('decode-field-physical')).toHaveText(
    'PASS (covers 10 B)',
  );
});

test('🚨 korumalı veri çerçevesi gövdeyi ŞİFRELİ damgasıyla bırakır — ÖTEYE İNİLMEZ', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'protected-data');

  await expect(fieldRow(page, 'fc-protected').getByTestId('decode-field-physical')).toHaveText(
    'encrypted body',
  );
  await expect(fieldRow(page, 'body')).toContainText('encrypted');
  await expect(fieldRow(page, 'body').getByTestId('decode-field-physical')).toContainText(
    'not decoded',
  );
  await expect(fieldWarning(page, 'body')).toHaveText(tr['protocol.wifi.field.encryptedPayload']);
  await expect(frameWarning(page, tr['protocol.wifi.warning.encryptedPayload'])).toHaveCount(1);

  // ToDS = 0 / FromDS = 1 dalı: Address 2 BSSID, Address 3 KAYNAK.
  await expect(fieldRow(page, 'address-2')).toContainText('Address 2 · BSSID');
  await expect(fieldRow(page, 'address-3')).toContainText('Address 3 · SA');

  // Gösterim şıkkı gövdeyi ÇÖZMEZ, yalnız ham baytları döker.
  await page.locator('#decode-option-protectedPayloadDisplay').selectOption('hex');
  await expect(fieldRow(page, 'body').getByTestId('decode-field-physical')).toContainText(
    '02 22 CD A0',
  );
  await expect(frameWarning(page, tr['protocol.wifi.warning.encryptedPayload'])).toHaveCount(1);
});

test('bozuk-FCS örneği FAIL basar ve çerçeve KISMEN çözülmüş kalır', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'corrupt-fcs');

  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
    'data-error-code',
    'crc-mismatch',
  );
  await expect(fieldRow(page, 'fcs').getByTestId('decode-field-physical')).toContainText('FAIL');
  await expect(fieldRow(page, 'fcs')).toHaveAttribute('data-valid', 'false');
  // Kısmi çözüm gösterilir (boş kart yasağı): alt tip ve parça numarası okunur.
  await expect(fieldRow(page, 'fc-subtype').getByTestId('decode-field-physical')).toHaveText(
    'Probe Request',
  );
  await expect(fieldRow(page, 'fragment-number').getByTestId('decode-field-physical')).toHaveText(
    '5',
  );
  // Belirsizlik SÖYLENİR: bozuk mu, yoksa FCS'siz girdi mi?
  await expect(frameWarning(page, tr['protocol.wifi.warning.fcsMismatch'])).toHaveCount(1);
});

test('adres rolü gösterimi ve dört adresli WDS dalı kanallarla EKRANDA değişir', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'four-address-wds');

  // Matrisin DÖRDÜNCÜ dalı: Address 3 hedef, Address 4 kaynak.
  await expect(fieldRow(page, 'address-4')).toHaveCount(1);
  await expect(fieldRow(page, 'address-3')).toContainText('Address 3 · DA');
  await expect(fieldRow(page, 'address-4')).toContainText('Address 4 · SA');

  await page.locator('#decode-option-addressRoleDisplay').selectOption('raw');
  await expect(fieldRow(page, 'address-3')).not.toContainText('· DA');

  await page.locator('#decode-option-addressRoleDisplay').selectOption('both');
  await expect(fieldRow(page, 'address-1')).toContainText('Address 1 · RA');

  // Üretici etiketi kapatılabilir ama grup adresinin ANLAMI kaybolmaz.
  await page.locator('#decode-option-vendorAddressLabels').selectOption('hide');
  await expect(fieldRow(page, 'address-2').getByTestId('decode-field-physical')).not.toContainText(
    'Cisco',
  );
  await expect(fieldRow(page, 'address-1').getByTestId('decode-field-physical')).toContainText(
    'Spanning Tree',
  );
});

test('`fcsPresent` = yok seçilince FCS satırı KAYBOLUR ve element zinciri ARTIK BAYT bırakır', async ({
  page,
}) => {
  await openDecodePanel(page);
  await expect(fieldRow(page, 'fcs')).toHaveCount(1);
  await expect(fieldRow(page, 'ie-trailing')).toHaveCount(0);

  await page.locator('#decode-option-fcsPresent').selectOption('no');
  // Olmayan bir doğrulama VARMIŞ gibi gösterilmez: satır hiç basılmaz.
  await expect(fieldRow(page, 'fcs')).toHaveCount(0);
  await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  // 🚨 FCS'in dört baytı gövdeye katılınca element zinciri TEMİZ BİTMİYOR ve
  // bu, dört baytın gerçekten FCS olduğunun ekrandaki KANITI: zincirin
  // kendisi "burada bir TLV yok" diyor. Uydurma bir eleman BASILMIYOR.
  await expect(fieldRow(page, 'ie-trailing')).toHaveCount(1);
  await expect(fieldRow(page, 'ie-trailing').getByTestId('decode-field-raw')).toContainText(
    '9F 61 C9 5C',
  );
  await expect(
    frameWarning(page, tr['protocol.wifi.warning.elementChainTruncated']),
  ).toHaveCount(1);
});

test('🚨 gerçek Beacon`ın gövdesi: SSID, kanal, aralık, Privacy ve RSN üçlüsü EKRANDA', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(fieldRow(page, 'mgmt-timestamp')).toContainText('Timestamp');
  await expect(fieldRow(page, 'mgmt-beacon-interval').getByTestId('decode-field-physical')).toContainText(
    '100',
  );
  await expect(fieldRow(page, 'mgmt-capability').getByTestId('decode-field-physical')).toHaveText(
    'ESS, Privacy, Short Slot Time',
  );
  // Privacy AYRI satır: bit SIFIR olduğunda da görünsün diye.
  await expect(
    fieldRow(page, 'mgmt-capability-privacy').getByTestId('decode-field-physical'),
  ).toContainText('WEP/TKIP/CCMP required');

  await expect(fieldRow(page, 'ie-0').getByTestId('decode-field-physical')).toHaveText('"Coherer"');
  await expect(fieldRow(page, 'ie-3').getByTestId('decode-field-physical')).toHaveText('channel 1');
  await expect(fieldRow(page, 'ie-1').getByTestId('decode-field-physical')).toContainText(
    'Mbit/s',
  );

  // RSN'in iç içe sayaç zinciri: CCMP + TKIP / PSK üçlüsü.
  await expect(fieldRow(page, 'rsn-pairwise-suite').getByTestId('decode-field-physical')).toContainText(
    'CCMP-128',
  );
  await expect(
    fieldRow(page, 'rsn-pairwise-suite-2').getByTestId('decode-field-physical'),
  ).toContainText('TKIP');
  await expect(fieldRow(page, 'rsn-akm-suite').getByTestId('decode-field-physical')).toContainText(
    'PSK',
  );

  // Element ID 47 UYDURULMADI: Wireshark'ın TAG_ERP_INFO_OLD'u.
  await expect(fieldRow(page, 'ie-47')).toContainText('ERP Information (802.11g/D4.0)');
});

test('🚨 aynı Beacon`ın WPA vendor IE`si AYRI satırlarda ve OUI`siyle basılıyor', async ({
  page,
}) => {
  await openDecodePanel(page);

  await expect(fieldRow(page, 'ie-221-2').getByTestId('decode-field-physical')).toContainText(
    '00-50-F2',
  );
  // AYNI süit numarası, FARKLI OUI: iki satır aynı metni BASMAZ.
  await expect(fieldRow(page, 'wpa-akm-suite').getByTestId('decode-field-physical')).toContainText(
    '00-50-F2',
  );
  await expect(fieldRow(page, 'rsn-akm-suite').getByTestId('decode-field-physical')).toContainText(
    '00-0F-AC',
  );

  // Süit adları kapatılınca HAM SEÇİCİ kalır — ad telde yok.
  await page.locator('#decode-option-rsnSuiteLabels').selectOption('hide');
  await expect(fieldRow(page, 'rsn-akm-suite').getByTestId('decode-field-physical')).toHaveText(
    '00-0F-AC:2',
  );
});

test('🚨 bozuk RSN sayacı UYARI basar, sayfa ÇÖKMEZ ve kalan alanlar ÇÖZÜLMEYE devam eder', async ({
  page,
}) => {
  const consoleErrors = await openDecodePanel(page);
  await selectExample(page, 'broken-rsn-counter');

  await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
    'data-error-code',
    'length-mismatch',
  );
  await expect(frameWarning(page, tr['protocol.wifi.warning.rsnCounterOverrun'])).toHaveCount(1);
  // 684 AKM süiti UYDURULMADI: tek bir AKM satırı bile yok.
  await expect(fieldRow(page, 'rsn-akm-count').getByTestId('decode-field-physical')).toContainText(
    '684',
  );
  await expect(fieldRow(page, 'rsn-akm-suite')).toHaveCount(0);
  await expect(fieldRow(page, 'rsn-undecoded')).toHaveCount(1);
  // Zincir durdu ama ÇERÇEVE durmadı: sonraki element ve FCS hâlâ okunuyor.
  await expect(fieldRow(page, 'ie-50')).toHaveCount(1);
  await expect(fieldRow(page, 'fcs')).toHaveAttribute('data-valid', 'true');

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('gizli SSID "wildcard" der — BOŞ KART BASMAZ', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'hidden-ssid');

  const ssid = fieldRow(page, 'ie-0').getByTestId('decode-field-physical');
  await expect(ssid).toContainText('wildcard');
  await expect(ssid).toContainText('hidden SSID');
  await expect(fieldWarning(page, 'ie-0')).toHaveText(tr['protocol.wifi.field.hiddenSsid']);
});

test('Authentication gövdesi "Open System / seq 1 / Successful" üçlüsünü basar', async ({
  page,
}) => {
  await openDecodePanel(page);
  await selectExample(page, 'authentication');

  await expect(
    fieldRow(page, 'mgmt-auth-algorithm').getByTestId('decode-field-physical'),
  ).toContainText('Open System');
  await expect(
    fieldRow(page, 'mgmt-auth-sequence').getByTestId('decode-field-physical'),
  ).toHaveText('1');
  await expect(fieldRow(page, 'mgmt-status-code').getByTestId('decode-field-physical')).toContainText(
    'Successful',
  );
  // Auth'ta element zinciri YOK: 24 + 6 + 0 + 4 = 34.
  await expect(fieldRow(page, 'ie-0')).toHaveCount(0);
});

test('`ieNameSet` = adlandırma yok DÜZ TLV görünümü verir, RSN zinciri KAPANIR', async ({
  page,
}) => {
  await openDecodePanel(page);
  await expect(fieldRow(page, 'rsn-version')).toHaveCount(1);

  await page.locator('#decode-option-ieNameSet').selectOption('none');
  await expect(fieldRow(page, 'rsn-version')).toHaveCount(0);
  await expect(fieldRow(page, 'ie-0')).toContainText('Element 0');
  await expect(fieldRow(page, 'ie-0').getByTestId('decode-field-physical')).toContainText(
    'naming is turned off',
  );

  // Adlandırılmamış satırlar gizlenince tablo GERÇEKTEN küçülür.
  await page.locator('#decode-option-unknownIeDisplay').selectOption('hidden');
  await expect(fieldRow(page, 'ie-0')).toHaveCount(0);
  await expect(frameWarning(page, tr['protocol.wifi.warning.hiddenElements'])).toHaveCount(1);
});

test('QoS Data örneği QoS Control ve TID satırlarını basar', async ({ page }) => {
  await openDecodePanel(page);
  await selectExample(page, 'qos-data');

  await expect(fieldRow(page, 'fc-subtype').getByTestId('decode-field-physical')).toHaveText(
    'QoS Data',
  );
  await expect(fieldRow(page, 'qos-control')).toHaveCount(1);
  await expect(fieldRow(page, 'qos-tid').getByTestId('decode-field-physical')).toHaveText('6');
});

test('girdi sözleşmesi her çözümde söylenir — radiotap KAPSAM DIŞI', async ({ page }) => {
  await openDecodePanel(page);
  await expect(frameWarning(page, tr['protocol.wifi.warning.radiotapOutOfScope'])).toHaveCount(1);
});

test('`timing` sekmesi "planlandı" basar — airtime hesapları bu dalgada YAZILMADI', async ({
  page,
}) => {
  const consoleErrors = await openPage(page, TIMING_PATH);

  await expect(page.getByText(tr['protocol.plannedNotice'])).toBeVisible();
  // Sayfanın KENDİ rozeti yine "Kısmi"dir: sekme planlı, kayıt değil.
  await expect(page.getByText(tr['status.partial'], { exact: true })).toBeVisible();

  expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
});

test('uyarı ve hata metinleri ÇEVRİLMİŞ basılır — ham anahtar sızmaz', async ({ page }) => {
  await openDecodePanel(page);
  await expectNoRawTranslationKeys(page);

  await selectExample(page, 'protected-data');
  await expectNoRawTranslationKeys(page);
  await selectExample(page, 'corrupt-fcs');
  await expectNoRawTranslationKeys(page);
  await selectExample(page, 'broken-rsn-counter');
  await expectNoRawTranslationKeys(page);
  await selectExample(page, 'hidden-ssid');
  await expectNoRawTranslationKeys(page);
});

test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDecodePanel(page);
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  expect(
    await horizontalOverflow(page),
    'sayfa 1440px genişlikte yatayda taşıyor',
  ).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('decode-field-table')).toBeVisible();
  expect(
    await horizontalOverflow(page),
    'sayfa 390px genişlikte yatayda taşıyor',
  ).toBeLessThanOrEqual(0);
});
