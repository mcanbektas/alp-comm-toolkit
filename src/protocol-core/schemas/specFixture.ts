/**
 * Spec §9.6'nın "AYNEN" işaretli protokol şeması ve §43'ün doğrulanmış
 * çerçevesi — testlerin ve varsayılan örneğin tek kaynağı.
 *
 * Çerçeve: `AA 05 10 03 34 12 7F 4F 55`
 *   AA        framing start
 *   05        address        = 5
 *   10        command        = 0x10 → "Sensor Data"
 *   03        payloadLength  = 3
 *   34 12 7F  payload
 *   4F        checksum       = XOR8(05^10^03^34^12^7F) = 0x4F ✓
 *   55        framing end
 *
 * Bu değerler spec §8.3 (canlı mesaj), §9.6 (şema) ve §43 (kabul fixture'ı)
 * arasında tutarlı; üçü de aynı çerçeveyi gösteriyor.
 */

import type { ProtocolSchema } from './protocolSchema';

/** §9.6'nın JSON'u, anahtar adları ve sırası korunarak. */
export const SPEC_SENSOR_PROTOCOL_JSON = `{
  "name": "ALP Sensor Protocol",
  "version": "1.0",
  "framing": {
    "type": "startEnd",
    "startBytes": [170],
    "endBytes": [85],
    "maximumFrameLength": 256
  },
  "fields": [
    {
      "id": "address",
      "name": "Device Address",
      "type": "uint8",
      "offset": 1,
      "length": 1
    },
    {
      "id": "command",
      "name": "Command",
      "type": "enum",
      "offset": 2,
      "length": 1,
      "enumValues": {
        "16": "Sensor Data",
        "32": "Set Output",
        "48": "Status Request"
      }
    },
    {
      "id": "payloadLength",
      "name": "Payload Length",
      "type": "uint8",
      "offset": 3,
      "length": 1
    },
    {
      "id": "payload",
      "name": "Payload",
      "type": "rawBytes",
      "offset": 4,
      "lengthFrom": "payloadLength"
    },
    {
      "id": "checksum",
      "name": "Checksum",
      "type": "checksum",
      "algorithm": "xor8",
      "coverage": {
        "startField": "address",
        "endField": "payload"
      }
    }
  ]
}`;

export const SPEC_SENSOR_PROTOCOL: ProtocolSchema = {
  name: 'ALP Sensor Protocol',
  version: '1.0',
  framing: {
    type: 'startEnd',
    startBytes: [0xaa],
    endBytes: [0x55],
    maximumFrameLength: 256,
  },
  fields: [
    { id: 'address', name: 'Device Address', type: 'uint8', offset: 1, length: 1 },
    {
      id: 'command',
      name: 'Command',
      type: 'enum',
      offset: 2,
      length: 1,
      enumValues: { '16': 'Sensor Data', '32': 'Set Output', '48': 'Status Request' },
    },
    { id: 'payloadLength', name: 'Payload Length', type: 'uint8', offset: 3, length: 1 },
    { id: 'payload', name: 'Payload', type: 'rawBytes', offset: 4, lengthFrom: 'payloadLength' },
    {
      id: 'checksum',
      name: 'Checksum',
      type: 'checksum',
      algorithm: 'xor8',
      coverage: { startField: 'address', endField: 'payload' },
    },
  ],
};

/** Spec §43'ün kabul çerçevesi. */
export const SPEC_SENSOR_FRAME = Uint8Array.from([
  0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55,
]);

/**
 * Spec §10'un Packet Builder örneği: Set Output, kanal 2, %75 duty.
 *
 * **SPEC HATASI, bilerek düzeltildi.** §10 paketi `AA 05 20 02 02 4B 6C 55`
 * diye yazıyor ama `6C` hiçbir makul hesapla çıkmıyor:
 *
 *   XOR8(05 20 02 02 4B)      = 0x6E   ← §9.6'nın kapsam tanımı (address..payload)
 *   XOR8(AA 05 20 02 02 4B)   = 0xC4   ← start baytı da dahil edilseydi
 *   SUM8(05 20 02 02 4B)      = 0x74
 *
 * §9.6'nın şeması ve §43'ün `AA 05 10 03 34 12 7F 4F 55` çerçevesi kendi
 * içinde TUTARLI (0x4F doğrulandı), yani protokol tanımı sağlam; yanlış olan
 * yalnız §10'un örnek paketi. Motoru spec'in dizgi hatasına uydurmak, doğru
 * checksum üreten kodu "hatalı" saymak olurdu — bu yüzden 0x6E kullanılıyor.
 */
export const SPEC_BUILDER_FRAME = Uint8Array.from([
  0xaa, 0x05, 0x20, 0x02, 0x02, 0x4b, 0x6e, 0x55,
]);
