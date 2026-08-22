import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations';

/**
 * Faz 10 dalga 11k'nin gerçek tarayıcı turu — Ethernet Interface (MDIO).
 *
 * Kanıtladığı şeyler: kanonik sayfanın Hazır rozetiyle açıldığı; okuma
 * çerçevesinde ST/OP/PHYAD/REGAD/TA/DATA alanlarının ve BMSR bit satırlarının
 * göründüğü; cevapsız okumanın (TA=11) uyarıyla işaretlendiği; Clause 45
 * çerçevesinin ADLANDIĞI ama alanlara ayrılmadığı; SPE ve Ethernet II
 * çapraz-linklerinin Genel bakış sekmesinde basıldığı.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/interfaces-framing/host-network-interfaces/ethernet-interface?tab=decode';
const OVERVIEW_PATH = '/comm/interfaces-framing/host-network-interfaces/ethernet-interface?tab=overview';

async function openDecodePanel(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('alp-comm-lang', 'tr');
  });

  await page.goto(DECODE_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('decode-panel')).toBeVisible();
  return consoleErrors;
}

function fieldRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-testid="decode-field-row"][data-field-id="${fieldId}"]`);
}

test.describe('Ethernet Interface (MDIO)', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ethernet Interface');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'ethernet-interface');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('BMSR okuma örneği alanları ve link özetini basar', async ({ page }) => {
    await openDecodePanel(page);

    await page.getByLabel(tr['decode.example.label']).selectOption('read-bmsr');

    await expect(fieldRow(page, 'start').getByTestId('decode-field-physical')).toHaveText(
      '0b01 · Clause 22',
    );
    await expect(fieldRow(page, 'opcode').getByTestId('decode-field-physical')).toHaveText('0b10 · Read');
    await expect(fieldRow(page, 'phyAddress').getByTestId('decode-field-physical')).toHaveText('1');
    await expect(fieldRow(page, 'registerAddress').getByTestId('decode-field-physical')).toHaveText(
      '1 · BMSR',
    );
    await expect(fieldRow(page, 'data').getByTestId('decode-field-physical')).toHaveText(
      '0x782D · Link UP · Auto-Negotiation complete',
    );
    // Register bit satırları: link status biti 2.
    await expect(fieldRow(page, 'bmsr.2').getByTestId('decode-field-physical')).toHaveText('bit 2 · set');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('BMCR yazma örneği AN etkinken hız/duplex bitlerinin yok sayıldığını söyler', async ({ page }) => {
    await openDecodePanel(page);

    await page.getByLabel(tr['decode.example.label']).selectOption('write-bmcr');

    await expect(fieldRow(page, 'opcode').getByTestId('decode-field-physical')).toHaveText('0b01 · Write');
    await expect(fieldRow(page, 'data').getByTestId('decode-field-physical')).toContainText(
      'speed/duplex bits ignored',
    );
  });

  test('ANLPAR okuması partner yeteneğini özetler', async ({ page }) => {
    await openDecodePanel(page);

    await page.getByLabel(tr['decode.example.label']).selectOption('read-anlpar');

    await expect(fieldRow(page, 'data').getByTestId('decode-field-physical')).toHaveText(
      '0x45E1 · Partner 10/100 capable',
    );
  });

  test('cevapsız okuma uyarı basar ve ham anahtar göstermez', async ({ page }) => {
    await openDecodePanel(page);

    await page.getByLabel(tr['decode.example.label']).selectOption('no-phy');

    const warning = page.getByText(tr['protocol.mdio.warning.noPhyResponse']);
    await expect(warning).toBeVisible();
    await expect(page.getByText('protocol.mdio.warning')).toHaveCount(0);
    await expect(fieldRow(page, 'turnaround').getByTestId('decode-field-physical')).toHaveText('0b11');
    // 0xFFFF register içeriği sanılmaz: özet ve bit satırları basılmaz.
    await expect(fieldRow(page, 'data').getByTestId('decode-field-physical')).toHaveText(
      '0xFFFF · no response',
    );
    await expect(fieldRow(page, 'bmsr.2')).toHaveCount(0);
  });

  test('Clause 45 çerçevesi adlanır ama alanlara ayrılmaz', async ({ page }) => {
    await openDecodePanel(page);

    await page.getByLabel(tr['decode.example.label']).selectOption('clause-45');

    await expect(fieldRow(page, 'start').getByTestId('decode-field-physical')).toHaveText(
      '0b00 · Clause 45',
    );
    await expect(fieldRow(page, 'clause45Frame')).toHaveCount(1);
    await expect(fieldRow(page, 'phyAddress')).toHaveCount(0);
    await expect(page.getByText(tr['protocol.mdio.warning.clause45'])).toBeVisible();
  });

  test('Genel bakış sekmesinde SPE ve Ethernet II çapraz-linkleri görünür', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'tr');
    });
    await page.goto(OVERVIEW_PATH);

    await expect(page.getByRole('link', { name: 'Single Pair Ethernet', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ethernet II', exact: true })).toBeVisible();
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(DECODE_PATH);
    await page.getByLabel(translations.en['decode.example.label']).selectOption('read-bmsr');
    await expect(fieldRow(page, 'data').getByTestId('decode-field-physical')).toHaveText(
      '0x782D · Link UP · Auto-Negotiation complete',
    );
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page);
    await page.getByLabel(tr['decode.example.label']).selectOption('read-bmsr');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
