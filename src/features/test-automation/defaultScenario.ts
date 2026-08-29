/**
 * Ekranın açılış senaryosu ve onu gerçekten koşturan simüle cihaz.
 *
 * Spec §38'in kendi örnek senaryosunun (39421-39429) uygulanabilir hâli:
 * bağlan → status request gönder → bekle → 0x31 yerine bu depoda doğrulanmış
 * bir komut baytı olan 0x10'lu yanıtı bekle → CRC doğrula → sıcaklığı oku →
 * eşiği aş(ma) → günlüğe yaz → raporu dışa aktar → bağlantıyı kapat.
 *
 * Yanıt çerçevesi uydurma DEĞİL: spec §43'ün custom protocol fixture'ı
 * (`AA 05 10 03 34 12 7F 4F 55`), XOR checksum'ı bayt 1..6'yı kapsıyor ve
 * doğrulanmış. Ekran bu yüzden boş açılmaz ve ilk tıklamada gerçek bir rapor
 * üretir — "boş kart basmak yasak" kuralının bu ekrandaki karşılığı.
 *
 * Örnekteki eşik 85: §38 satır 39427'nin kendi sayısı. Fixture'ın sıcaklık
 * baytı 0x34 = 52, yani varsayılan koşu GEÇER; kullanıcı eşiği 50'ye çekip
 * kırmızıyı da görebilir.
 */

import { SCENARIO_FORMAT_VERSION } from './scenario';
import type { DeviceRule } from '../../connection/mock/simulatedDevice';
import type { TestScenario } from './scenario';

/** Spec §43 custom protocol fixture'ı. */
export const DEMO_RESPONSE_FRAME = [0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55];
export const DEMO_STATUS_REQUEST = [0xaa, 0x01];

/** Simüle cihazın varsayılan kuralı: status request'e fixture çerçevesiyle yanıt. */
export const DEFAULT_DEVICE_RULES: readonly DeviceRule[] = [
  { match: { offset: 0, bytes: DEMO_STATUS_REQUEST }, response: DEMO_RESPONSE_FRAME, delayMs: 20 },
];

export const DEFAULT_SCENARIO: TestScenario = {
  formatVersion: SCENARIO_FORMAT_VERSION,
  name: 'Sıcaklık durum testi',
  steps: [
    { id: 'connect', kind: 'connect' },
    { id: 'send', kind: 'send-frame', payload: { source: 'bytes', bytes: DEMO_STATUS_REQUEST } },
    { id: 'settle', kind: 'wait', durationMs: 100 },
    { id: 'response', kind: 'wait-for-frame', timeoutMs: 500, match: { offset: 2, bytes: [0x10] } },
    { id: 'crc', kind: 'validate-crc', algorithm: 'xor8', dataStart: 1, trailingOffset: 1, endianness: 'big' },
    {
      id: 'read-temperature',
      kind: 'set-variable',
      name: 'temperature',
      value: { kind: 'frame-field', offset: 4, width: 1, endianness: 'big' },
    },
    {
      id: 'limit',
      kind: 'validate-field',
      condition: {
        kind: 'compare',
        left: { kind: 'variable', name: 'temperature' },
        operator: '<=',
        right: { kind: 'constant', value: 85 },
      },
    },
    { id: 'log', kind: 'log', message: 'Sıcaklık: {temperature}' },
    { id: 'report', kind: 'export-report' },
    { id: 'disconnect', kind: 'disconnect' },
  ],
};
