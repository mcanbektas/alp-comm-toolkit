import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 15e'nin gerçek tarayıcı turu — PWM Servo.
 *
 * Kanıtladığı şeyler: sayfa Hazır rozetiyle açılıyor; kalibrasyon OLMADAN da
 * Pulse Width/Frame Period/Frequency/Duty Cycle çözülüyor (PPM'in aksine, bu
 * kaydın çözümü bir kanal AYRIMI beklemiyor); Servo Position alanı YALNIZ üç
 * kalibrasyon değeri de verilince beliriyor (spec :283); LOW nabız 6553.5 µs
 * konteyner sınırını aşınca (gerçek 20 ms/50 Hz kalibrasyonunda TİPİK vaka)
 * Period/Frequency/Duty Cycle YÖNÜ BELLİ birer sınır olarak gösteriliyor.
 */

const tr = translations.tr;

const PWM_SERVO_DECODE_PATH = '/comm/aerospace-uav/rc-control-links/pwm-servo?tab=decode';

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

function frameWarning(page: Page, text: string): Locator {
  return page.locator('[data-testid="decode-frame-warning"]').filter({ hasText: text });
}

test.describe('PWM Servo', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, PWM_SERVO_DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PWM Servo');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'pwm-servo');
    await expect(page.getByText(tr['status.ready'], { exact: true }).first()).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('kalibrasyon OLMADAN Pulse Width/Frame Period/Frequency/Duty Cycle çözülür', async ({ page }) => {
    await openDecodePanel(page, PWM_SERVO_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('single-cycle-typical');

    // `decode-field-physical` hücresi `physicalValue`ya `unit`i BOŞLUKLA ekler
    // (DecodePanel.tsx `formatPhysicalCell` — tüm protokollerde ortak biçim).
    await expect(fieldRow(page, 'cycle-0-pulse-width').getByTestId('decode-field-physical')).toHaveText(
      '1500.0 µs',
    );
    await expect(fieldRow(page, 'cycle-0-period').getByTestId('decode-field-physical')).toHaveText(
      '3500.0 µs',
    );
    await expect(fieldRow(page, 'cycle-0-frequency')).toBeVisible();
    await expect(fieldRow(page, 'cycle-0-duty-cycle')).toBeVisible();
    // Kalibrasyon verilmediği için Servo Position alanı HENÜZ YOK.
    await expect(fieldRow(page, 'cycle-0-servo-position')).toHaveCount(0);
  });

  test('Servo Position YALNIZ üç kalibrasyon değeri de verilince belirir — spec :283', async ({ page }) => {
    await openDecodePanel(page, PWM_SERVO_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('multi-channel-servo-positions');

    await page.getByLabel(tr['protocol.pwmServo.option.minPulseUs']).fill('1000');
    await page.getByLabel(tr['protocol.pwmServo.option.centerPulseUs']).fill('1500');
    await expect(fieldRow(page, 'cycle-1-servo-position')).toHaveCount(0);

    await page.getByLabel(tr['protocol.pwmServo.option.maxPulseUs']).fill('2000');
    // Spec :283'ün KENDİ multi-channel örneği: Servo2=1230 → -54.0%, Servo3=1782 → +56.4%.
    await expect(fieldRow(page, 'cycle-1-servo-position').getByTestId('decode-field-physical')).toHaveText(
      '-54.0 %',
    );
    await expect(fieldRow(page, 'cycle-2-servo-position').getByTestId('decode-field-physical')).toHaveText(
      '56.4 %',
    );
  });

  test('LOW doygunsa (gerçekçi 20 ms/50 Hz) Period/Frequency/Duty Cycle YÖNÜ BELLİ birer sınır olur', async ({
    page,
  }) => {
    await openDecodePanel(page, PWM_SERVO_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('low-saturates-realistic-period');

    const period = fieldRow(page, 'cycle-0-period').getByTestId('decode-field-physical');
    const frequency = fieldRow(page, 'cycle-0-frequency').getByTestId('decode-field-physical');
    const dutyCycle = fieldRow(page, 'cycle-0-duty-cycle').getByTestId('decode-field-physical');

    await expect(period).toContainText('≥');
    await expect(frequency).toContainText('≤');
    await expect(dutyCycle).toContainText('≤');
    await expect(
      frameWarning(page, tr['protocol.pwmServo.warning.pulseMayBeSaturated']),
    ).toBeVisible();
    // decode-frame-error YOK — bu bir hata değil, ölçüm sınırının dürüst bildirimi.
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
  });

  test('jitter-sample: Mean=1500.2 µs, Peak-to-Peak=6 µs — spec :284', async ({ page }) => {
    await openDecodePanel(page, PWM_SERVO_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('jitter-sample');

    await expect(fieldRow(page, 'jitter-mean').getByTestId('decode-field-physical')).toHaveText(
      '1500.2 µs',
    );
    await expect(fieldRow(page, 'jitter-peak-to-peak').getByTestId('decode-field-physical')).toHaveText(
      '6.0 µs',
    );
  });

  test('missing-pulse: LOW rezerve ise Frame Period üretilmez, missingPulse uyarır', async ({ page }) => {
    await openDecodePanel(page, PWM_SERVO_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('missing-pulse');

    await expect(fieldRow(page, 'cycle-0-pulse-width').getByTestId('decode-field-physical')).toHaveText(
      '1500.0 µs',
    );
    await expect(fieldRow(page, 'cycle-0-period')).toHaveCount(0);
    await expect(frameWarning(page, tr['protocol.pwmServo.warning.missingPulse'])).toBeVisible();
  });

  test('initialPulseLevel=low: eşleştirme bir kayar, ilk nabız Leading Pulse olarak gösterilir', async ({
    page,
  }) => {
    await openDecodePanel(page, PWM_SERVO_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('multi-channel-servo-positions');

    const beforeHigh = await fieldRow(page, 'cycle-0-pulse-width')
      .getByTestId('decode-field-physical')
      .textContent();

    await page.getByLabel(tr['protocol.pwmServo.option.initialPulseLevel']).selectOption('low');

    await expect(fieldRow(page, 'leading-low')).toBeVisible();
    const afterHigh = await fieldRow(page, 'cycle-0-pulse-width')
      .getByTestId('decode-field-physical')
      .textContent();
    expect(afterHigh, 'initialPulseLevel değişince eşleştirme kaymalı, ilk HIGH farklı bir nabız olmalı').not.toBe(
      beforeHigh,
    );
  });

  test('eksik çerçeve (tek uzunluk) decode-parse-error basar', async ({ page }) => {
    await openDecodePanel(page, PWM_SERVO_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('truncated');

    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-parse-error')).toHaveAttribute('data-error-code', 'truncated-frame');
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, PWM_SERVO_DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('jitter-sample');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
