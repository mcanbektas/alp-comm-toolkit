import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translations } from '../src/translations/all';

/**
 * Faz 10 dalga 13c'nin gerçek tarayıcı turu — OPC UA.
 *
 * Kanıtladığı şeyler: kanonik sayfanın (industrial-automation/scada-utility/
 * opc-ua) Hazır rozetiyle açıldığı; UACP mesajlarının (HEL/ACK/ERR/RHE) ve
 * UASC zarfının (OPN'in asimetrik başlığı, MSG'nin simetrik başlığı,
 * SequenceHeader) ekranda çözüldüğü; ChunkType F/C/A ayrımının ve KRİPTO
 * SINIRININ (şifreli gövde çözülmez, imza/sertifika doğrulanmaz) kullanıcıya
 * gerçekten göründüğü; `decodeOptions`in (bodySecurity / signatureLength)
 * alan yerleşimini fiilen değiştirdiği.
 *
 * DecodePanel tuzakları (önceki dalgalardan, tekrar düşülmedi):
 * - Alan uyarısı `fieldRow(...)`un İÇİNDE değil kökte AYRI `<tr>`de basılır.
 * - `success:false` çerçevesi `decode-frame-error` DEĞİL `decode-parse-error`
 *   kartı basar; `success:true` + `valid:false` ise `decode-frame-error`.
 * - `decode-field-raw` STRING rawValue'yu OLDUĞU GİBİ, NUMBER rawValue'yu
 *   `0x… (…)` biçiminde basar — sayısal alanlarda `toContainText` kullanılır.
 * - `unit` yalnız `physicalValue` DOLUYSA değere yapıştırılır.
 * - Birden çok çerçeve uyarısında `getByTestId` strict-mode ihlali verir;
 *   `.filter({ hasText })` ile süzülür.
 */

const tr = translations.tr;

const DECODE_PATH = '/comm/industrial-automation/scada-utility/opc-ua?tab=decode';

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

function fieldWarning(page: Page, fieldId: string): Locator {
  // Uyarı satırı alan satırının İÇİNDE değil, kökte AYRI bir `<tr>`de.
  return page.locator(`[data-testid="decode-field-warning"][data-field-id="${fieldId}"]`);
}

function frameWarning(page: Page, text: string): Locator {
  return page.getByTestId('decode-frame-warning').filter({ hasText: text });
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

test.describe('OPC UA', () => {
  test('decode sekmesi Hazır rozetiyle açılır ve konsola hata basmaz', async ({ page }) => {
    const consoleErrors = await openDecodePanel(page, DECODE_PATH);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('OPC UA');
    await expect(page.getByTestId('decode-panel')).toHaveAttribute('data-plugin-id', 'opc-ua');
    await expect(page.getByText(tr['status.ready'], { exact: true })).toBeVisible();
    await expect(page.getByText(tr['protocol.plannedNotice'])).toHaveCount(0);

    expect(consoleErrors, `konsol hataları: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Hello örneği tampon parametrelerini birimiyle basar', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('hello');

    await expect(fieldRow(page, 'message-type').getByTestId('decode-field-raw')).toHaveText('HEL');
    await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText('Hello');
    await expect(fieldRow(page, 'chunk-type').getByTestId('decode-field-physical')).toHaveText('Final chunk');
    // `unit` fiziksel değere YAPIŞTIRILIR; physicalValue boşsa tek başına basılmaz.
    await expect(fieldRow(page, 'receive-buffer-size').getByTestId('decode-field-physical')).toHaveText(
      '65536 B',
    );
    await expect(fieldRow(page, 'endpoint-url').getByTestId('decode-field-physical')).toHaveText(
      'opc.tcp://localhost:4840',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Acknowledge EndpointUrl TAŞIMAZ — Hello ile aynı sanılamaz', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('acknowledge');

    await expect(fieldRow(page, 'max-chunk-count').getByTestId('decode-field-raw')).toContainText('5');
    await expect(fieldRow(page, 'endpoint-url')).toHaveCount(0);
    await expect(fieldRow(page, 'sequence-number')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Error mesajı StatusCode adını çözer', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('error-endpoint-url-invalid');

    await expect(fieldRow(page, 'error-code').getByTestId('decode-field-physical')).toHaveText(
      'BadTcpEndpointUrlInvalid (0x80830000)',
    );
    await expect(fieldRow(page, 'error-reason').getByTestId('decode-field-physical')).toHaveText(
      'Endpoint URL invalid',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('null metin ile BOŞ metin ekranda AYRI görünür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('null-versus-empty-string');

    await expect(fieldRow(page, 'server-uri').getByTestId('decode-field-raw')).toHaveText('""');
    await expect(fieldRow(page, 'endpoint-url').getByTestId('decode-field-raw')).toHaveText('null');
    // null alanın fiziksel değeri YOKTUR — boş metninki BOŞ METİNdir.
    await expect(fieldRow(page, 'endpoint-url').getByTestId('decode-field-physical')).toHaveText('—');
    await expectNoRawTranslationKeys(page);
  });

  test('OPN #None politikasında zarf çözülür ve sertifika uyarısı basılır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('open-secure-channel-request-none');

    await expect(fieldRow(page, 'security-policy-uri').getByTestId('decode-field-physical')).toHaveText(
      'http://opcfoundation.org/UA/SecurityPolicy#None',
    );
    await expect(fieldRow(page, 'sender-certificate').getByTestId('decode-field-raw')).toHaveText('null');
    await expect(fieldWarning(page, 'sender-certificate')).toHaveText(
      tr['protocol.opcua.warning.certificateNotValidated'],
    );
    await expect(fieldRow(page, 'service-type-id').getByTestId('decode-field-physical')).toHaveText(
      'OpenSecureChannelRequest',
    );
    await expect(fieldRow(page, 'message-security-mode').getByTestId('decode-field-physical')).toHaveText(
      'None',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('Read isteği NodeId ve AttributeId adını çözer, damga 1601 epoch’undan gelir', async ({
    page,
  }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('read-request');

    await expect(fieldRow(page, 'service-type-id').getByTestId('decode-field-physical')).toHaveText(
      'ReadRequest',
    );
    // Unix epoch varsayan bir çözüm burada 369 yıl kayardı.
    await expect(fieldRow(page, 'request-timestamp').getByTestId('decode-field-physical')).toHaveText(
      '2024-01-01T00:00:00.000Z',
    );
    await expect(
      page.locator('[data-testid="decode-field-row"]').filter({ hasText: 'ReadValueId.NodeId' }),
    ).toContainText('ns=2;s=Machine1.Temperature');
    await expect(
      page.locator('[data-testid="decode-field-row"]').filter({ hasText: 'ReadValueId.AttributeId' }),
    ).toContainText('Value');
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('Read yanıtı DataValue’yu değer + durum + damga olarak biçimler', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('read-response');

    await expect(fieldRow(page, 'response-service-result').getByTestId('decode-field-physical')).toHaveText(
      'Good (0x00000000)',
    );
    await expect(
      page.locator('[data-testid="decode-field-row"]').filter({ hasText: 'Results[].DataValue' }),
    ).toContainText('Double=25.73');
    await expectNoRawTranslationKeys(page);
  });

  test('CreateSubscription isteği yayın aralığını ms biriminde basar', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('create-subscription-request');

    await expect(
      fieldRow(page, 'subscription-publishing-interval').getByTestId('decode-field-physical'),
    ).toHaveText('100 ms');
    await expect(
      fieldRow(page, 'subscription-publishing-enabled').getByTestId('decode-field-physical'),
    ).toHaveText('true');
    await expectNoRawTranslationKeys(page);
  });

  test('kapsam dışı servis: ad ve header çözülür, gövde HAM kalır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('create-session-request-body-raw');

    await expect(fieldRow(page, 'service-type-id').getByTestId('decode-field-physical')).toHaveText(
      'CreateSessionRequest',
    );
    await expect(fieldRow(page, 'request-handle').getByTestId('decode-field-raw')).toContainText('90');
    await expect(fieldWarning(page, 'service-body')).toHaveText(
      tr['protocol.opcua.warning.serviceBodyNotDecoded'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('Abort parçası (ChunkType A) servis DEĞİL, StatusCode + açıklama gösterir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('message-abort-chunk');

    await expect(fieldRow(page, 'chunk-type').getByTestId('decode-field-physical')).toHaveText(
      'Abort (final, message aborted)',
    );
    await expect(fieldRow(page, 'abort-status').getByTestId('decode-field-physical')).toHaveText(
      'BadResponseTooLarge (0x80B90000)',
    );
    await expect(fieldRow(page, 'service-type-id')).toHaveCount(0);
    await expect(frameWarning(page, tr['protocol.opcua.warning.chunkTypeNotFinal'])).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('ara parça (ChunkType C) gövdesine servis alanı UYDURULMAZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('message-intermediate-chunk');

    await expect(fieldRow(page, 'sequence-number').getByTestId('decode-field-raw')).toContainText('41');
    await expect(fieldRow(page, 'service-type-id')).toHaveCount(0);
    await expect(fieldWarning(page, 'chunk-body')).toHaveText(
      tr['protocol.opcua.warning.intermediateChunkBody'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('KRİPTO SINIRI: şifreli gövdede SequenceHeader bile okunmaz', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('message-encrypted-body');

    await expect(fieldRow(page, 'token-id').getByTestId('decode-field-raw')).toContainText('2');
    await expect(fieldRow(page, 'encrypted-payload').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expect(fieldRow(page, 'sequence-number')).toHaveCount(0);
    await expect(fieldRow(page, 'service-type-id')).toHaveCount(0);
    await expect(frameWarning(page, tr['protocol.opcua.warning.encryptedPayload'])).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('bodySecurity seçeneği açık gövdeyi şifreli saymaya zorlayabilir', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('read-request');
    await expect(fieldRow(page, 'service-type-id')).toHaveCount(1);

    await page.getByLabel(tr['protocol.opcua.option.bodySecurity']).selectOption('encrypted');

    await expect(fieldRow(page, 'encrypted-payload')).toHaveCount(1);
    await expect(fieldRow(page, 'service-type-id')).toHaveCount(0);
    await expect(fieldRow(page, 'sequence-number')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('signatureLength gövdenin sonunu imza olarak ayırır ama DOĞRULAMAZ', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('read-request');
    await expect(fieldRow(page, 'signature')).toHaveCount(0);

    await page.getByLabel(tr['protocol.opcua.option.signatureLength']).fill('8');

    await expect(fieldRow(page, 'signature').getByTestId('decode-field-physical')).toHaveText('8 B');
    await expect(fieldRow(page, 'signature').getByTestId('decode-field-validity')).toHaveText(
      tr['decode.status.invalid'],
    );
    await expect(fieldWarning(page, 'signature')).toHaveText(
      tr['protocol.opcua.warning.signatureNotVerified'],
    );
    await expectNoRawTranslationKeys(page);
  });

  test('tanınmayan mesaj tipi decode-parse-error kartı basar', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('unknown-message-type');

    // `success:false` → `decode-frame-error` DEĞİL `decode-parse-error`.
    await expect(page.getByTestId('decode-parse-error')).toHaveCount(1);
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('kesik gövde: kısmi alanlar kalır, çerçeve hatası basılır', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('truncated-body');

    // `success:true` + `valid:false` → `decode-frame-error`.
    await expect(page.getByTestId('decode-frame-error')).toHaveAttribute(
      'data-error-code',
      'truncated-frame',
    );
    await expect(fieldRow(page, 'send-buffer-size').getByTestId('decode-field-raw')).toContainText('65536');
    await expect(frameWarning(page, tr['protocol.opcua.warning.messageSizeExceedsBuffer'])).toHaveCount(1);
    await expectNoRawTranslationKeys(page);
  });

  test('elle yapıştırılan hex çözülür', async ({ page }) => {
    await openDecodePanel(page, DECODE_PATH);
    // ACK F, size=28; ver=0, rbs=sbs=8192, mms=0, mcc=0.
    await page
      .getByLabel(tr['decode.hexInput.label'])
      .fill('41 43 4B 46 1C 00 00 00 00 00 00 00 00 20 00 00 00 20 00 00 00 00 00 00 00 00 00 00');

    await expect(fieldRow(page, 'message-type').getByTestId('decode-field-physical')).toHaveText(
      'Acknowledge',
    );
    await expect(fieldRow(page, 'receive-buffer-size').getByTestId('decode-field-physical')).toHaveText(
      '8192 B',
    );
    await expect(page.getByTestId('decode-frame-error')).toHaveCount(0);
    await expectNoRawTranslationKeys(page);
  });

  test('İngilizce dilde de çevrilmemiş anahtar basmaz', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alp-comm-lang', 'en');
    });
    await page.goto(DECODE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('OPC UA');
    await page.getByLabel(translations.en['decode.example.label']).selectOption('message-encrypted-body');
    await expect(page.getByTestId('decode-frame-warning').first()).toContainText(
      'The encrypted region is not decoded',
    );
    await expectNoRawTranslationKeys(page);
  });

  test('1440 ve 390 pikselde yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDecodePanel(page, DECODE_PATH);
    await page.getByLabel(tr['decode.example.label']).selectOption('read-response');
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wide, 'sayfa 1440px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('decode-field-table')).toBeVisible();
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(narrow, 'sayfa 390px genişlikte yatayda taşıyor').toBeLessThanOrEqual(0);
  });
});
