import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 4a'nın gerçek tarayıcı turu — Ethernet II / IEEE 802.3 / VLAN 802.1Q.
 *
 * Kanıtladığı şey: TEK ortak parser'dan (`ethernetFrame.ts`) türeyen ÜÇ sayfanın
 * her biri kendi yorumunu (EtherType / Length / VLAN TCI) doğru basıyor; katman
 * zinciri istisnası (EtherType adlandırılır, payload çözülmez) ve FCS kararı
 * (hiç varsayılmaz, fırsatçı eşleşme yalnız bilgi notu) ekranda gerçekten
 * görünüyor — doip-decode.spec.ts'in deseni (fieldRow, expectNoRawTranslationKeys).
 */

const tr = translations.tr;

const ETHERNET_II_PATH = '/comm/network-ethernet/data-link/ethernet-ii?tab=decode';
const IEEE_802_3_PATH = '/comm/network-ethernet/data-link/ieee-802-3?tab=decode';
const VLAN_802_1Q_PATH = '/comm/network-ethernet/data-link/vlan-802-1q?tab=decode';

async function openDecodePanel(page: Page, path: string): Promise<string[]> {
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
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

async function expectNoRawTranslationKeys(page: Page): Promise<void> {
  for (const testId of ['decode-field-warning', 'decode-frame-warning', 'decode-frame-error']) {
    for (const metin of await page.getByTestId(testId).allTextContents()) {
      expect(metin.trim(), `${testId} çevrilmemiş anahtar basıyor`).not.toMatch(
        /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
      );
    }
  }
}

test.describe('Ethernet II', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, ETHERNET_II_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ethernet II');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ethernet-ii');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('broadcast ARP örneği MAC sınıflandırmasını ve EtherType adlandırmasını basar', async ({
    page,
  }) => {
    await openDecodePanel(page, ETHERNET_II_PATH);

    await expect(fieldRow(page, 'destination-mac').getByTestId('decode-field-raw')).toHaveText(
      'FF:FF:FF:FF:FF:FF',
    );
    await expect(fieldRow(page, 'destination-mac').getByTestId('decode-field-physical')).toHaveText(
      'Broadcast',
    );
    await expect(fieldRow(page, 'source-mac').getByTestId('decode-field-raw')).toHaveText(
      '00:11:22:33:44:55',
    );
    await expect(fieldRow(page, 'ethertype').getByTestId('decode-field-physical')).toHaveText('ARP');
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.ethernet.warning.etherTypeHigherLayer'],
    );

    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan EtherType örneği alanı geçersiz işaretler ve ayrı uyarı basar', async ({ page }) => {
    await openDecodePanel(page, ETHERNET_II_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('unknown-ethertype');

    await expect(fieldRow(page, 'ethertype').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.ethernet.warning.unknownEtherType'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('fırsatçı FCS eşleşmesi bilgi notu ekler, PASS/FAIL iddia etmez', async ({ page }) => {
    await openDecodePanel(page, ETHERNET_II_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('fcs-opportunistic-match');

    await expect(fieldRow(page, 'fcs').getByTestId('decode-field-physical')).toHaveText(
      'FCS not captured',
    );
    // Bu örnek İKİ uyarı basar (EtherType üst katman + fırsatçı FCS eşleşmesi) —
    // `.filter` ile hedefi daralt, strict-mode ihlaline düşme.
    await expect(
      page
        .getByTestId('decode-frame-warning')
        .filter({ hasText: tr['protocol.ethernet.warning.fcsOpportunisticMatch'] }),
    ).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });
});

test.describe('IEEE 802.3', () => {
  test('decode sekmesi Hazır rozetiyle açılır', async ({ page }) => {
    await openDecodePanel(page, IEEE_802_3_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('IEEE 802.3');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ieee-802-3');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  });

  test('Length örneği spec’in kendi sayısını basar (0x002E → 46 bayt)', async ({ page }) => {
    await openDecodePanel(page, IEEE_802_3_PATH);

    await expect(fieldRow(page, 'length').getByTestId('decode-field-raw')).toHaveText('0x2E (46)');
    await expect(fieldRow(page, 'length').getByTestId('decode-field-physical')).toHaveText(
      'IEEE 802.3 Payload Length = 46 bytes',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('tanımsız aralık örneği HATA değil UYARI basar, çözüm sürer', async ({ page }) => {
    await openDecodePanel(page, IEEE_802_3_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('undefined-range');

    await expect(fieldRow(page, 'type-length').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expect(page.getByTestId('decode-frame-warning')).toContainText(
      tr['protocol.ethernet.warning.undefinedTypeLengthRange'],
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(fieldRow(page, 'payload')).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });
});

test.describe('VLAN 802.1Q', () => {
  test('decode sekmesi Hazır rozetiyle açılır', async ({ page }) => {
    await openDecodePanel(page, VLAN_802_1Q_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('VLAN 802.1Q');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'vlan-802-1q');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
  });

  test('tek tag örneği PCP/DEI/VID’i spec’in sayılarıyla basar (PCP5/VID100)', async ({ page }) => {
    await openDecodePanel(page, VLAN_802_1Q_PATH);

    await expect(fieldRow(page, 'vlan-1-pcp').getByTestId('decode-field-raw')).toHaveText('0x5 (5)');
    await expect(fieldRow(page, 'vlan-1-dei').getByTestId('decode-field-raw')).toHaveText('0x0 (0)');
    await expect(fieldRow(page, 'vlan-1-vid').getByTestId('decode-field-raw')).toHaveText(
      '0x64 (100)',
    );
    await expect(fieldRow(page, 'ethertype').getByTestId('decode-field-physical')).toHaveText('IPv4');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('çift tag (stacking) örneği iki tag’i de ayrı ayrı basar (Tag#1 VID100 / Tag#2 VID20)', async ({
    page,
  }) => {
    await openDecodePanel(page, VLAN_802_1Q_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('double-tag-stacked');

    await expect(fieldRow(page, 'vlan-1-vid').getByTestId('decode-field-raw')).toHaveText(
      '0x64 (100)',
    );
    await expect(fieldRow(page, 'vlan-2-vid').getByTestId('decode-field-raw')).toHaveText('0x14 (20)');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('eksik TCI truncated-frame basar ama MAC alanları yine görünür', async ({ page }) => {
    await openDecodePanel(page, VLAN_802_1Q_PATH);

    await page.getByLabel(tr['decode.example.label']).selectOption('truncated-tci');

    const frameError = page.getByTestId('decode-frame-error');
    await expect(frameError).toHaveCount(1);
    await expect(frameError).toHaveAttribute('data-error-code', 'truncated-frame');
    await expect(fieldRow(page, 'destination-mac')).toHaveCount(1);
    await expect(fieldRow(page, 'source-mac')).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, VLAN_802_1Q_PATH);
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
