import { describe, expect, it } from 'vitest';

import {
  decodeDescriptorChain,
  decodeSetupRequest,
  isPossibleDescriptorPayload,
  isPossibleSetupPayload,
} from './usbDescriptors';

/** GET_DESCRIPTOR(Device), Table 9-2 + Table 9-4 + Table 9-5. */
const GET_DESCRIPTOR = Uint8Array.from([0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x12, 0x00]);

/** Spec ÖZETİNİN kendi örneği: VID 0x0483, PID 0x5740, CDC. */
const DEVICE_DESCRIPTOR = Uint8Array.from([
  0x12, 0x01, 0x00, 0x02, 0x02, 0x00, 0x00, 0x40, 0x83, 0x04, 0x40, 0x57, 0x00, 0x02, 0x01, 0x02,
  0x03, 0x01,
]);

const CONFIGURATION_CHAIN = Uint8Array.from([
  0x09, 0x02, 0x20, 0x00, 0x01, 0x01, 0x00, 0x80, 0x32, 0x09, 0x04, 0x00, 0x00, 0x02, 0x0a, 0x00,
  0x00, 0x00, 0x07, 0x05, 0x81, 0x02, 0x40, 0x00, 0x00, 0x07, 0x05, 0x01, 0x02, 0x40, 0x00, 0x00,
]);

describe('SETUP isteği (Table 9-2)', () => {
  it('GET_DESCRIPTOR(Device) isteğini alanlarına ayırır', () => {
    const request = decodeSetupRequest(GET_DESCRIPTOR);

    expect(request).toMatchObject({
      directionDeviceToHost: true,
      type: 'Standard',
      recipient: 'Device',
      bRequest: 6,
      requestName: 'GET_DESCRIPTOR',
      wValue: 0x0100,
      wLength: 18,
      descriptorType: 'DEVICE',
      descriptorIndex: 0,
    });
  });

  it('SET_ADDRESS host-to-device yönünde okunur', () => {
    const request = decodeSetupRequest(Uint8Array.from([0x00, 0x05, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00]));
    expect(request.directionDeviceToHost).toBe(false);
    expect(request.requestName).toBe('SET_ADDRESS');
    expect(request.wValue).toBe(7);
  });

  it('sınıf isteğinde standart ad UYDURULMAZ', () => {
    // bmRequestType 0x21: host-to-device, Class, Interface.
    const request = decodeSetupRequest(Uint8Array.from([0x21, 0x20, 0x00, 0x00, 0x00, 0x00, 0x07, 0x00]));
    expect(request.type).toBe('Class');
    expect(request.recipient).toBe('Interface');
    expect(request.requestName).toBeUndefined();
    expect(request.descriptorType).toBeUndefined();
  });

  it('rezerve edilmiş istek kodları ada bağlanmaz (Table 9-4: 2 ve 4 rezerve)', () => {
    expect(decodeSetupRequest(Uint8Array.from([0x00, 0x02, 0, 0, 0, 0, 0, 0])).requestName).toBeUndefined();
    expect(decodeSetupRequest(Uint8Array.from([0x00, 0x04, 0, 0, 0, 0, 0, 0])).requestName).toBeUndefined();
  });

  it('yalnız 8 baytlık yük SETUP adayıdır', () => {
    expect(isPossibleSetupPayload(GET_DESCRIPTOR)).toBe(true);
    expect(isPossibleSetupPayload(GET_DESCRIPTOR.slice(0, 7))).toBe(false);
    expect(isPossibleSetupPayload(DEVICE_DESCRIPTOR)).toBe(false);
  });
});

describe('tanımlayıcı çözümü (Table 9-8 / 9-10 / 9-12 / 9-13)', () => {
  it('cihaz tanımlayıcısını spec özetinin kendi örneğiyle çözer', () => {
    const [node] = decodeDescriptorChain(DEVICE_DESCRIPTOR);

    expect(node).toMatchObject({ bLength: 18, bDescriptorType: 1, typeName: 'DEVICE', truncated: false });
    const byName = Object.fromEntries((node?.fields ?? []).map((item) => [item.name, item]));
    expect(byName['idVendor']?.formatted).toBe('0x0483');
    expect(byName['idProduct']?.formatted).toBe('0x5740');
    expect(byName['bcdUSB']?.formatted).toBe('2.00');
    expect(byName['bMaxPacketSize0']?.value).toBe(64);
    expect(byName['bNumConfigurations']?.value).toBe(1);
  });

  it('configuration zincirini (config + interface + iki endpoint) yürür', () => {
    const nodes = decodeDescriptorChain(CONFIGURATION_CHAIN);

    expect(nodes.map((node) => node.typeName)).toEqual([
      'CONFIGURATION',
      'INTERFACE',
      'ENDPOINT',
      'ENDPOINT',
    ]);

    const config = Object.fromEntries((nodes[0]?.fields ?? []).map((item) => [item.name, item]));
    expect(config['wTotalLength']?.value).toBe(32);
    // Table 9-10: bMaxPower 2 mA birimindedir — 0x32 → 100 mA.
    expect(config['bMaxPower']?.formatted).toBe('100 mA');
    expect(config['bmAttributes']?.formatted).toContain('Bus-powered');

    const endpointIn = Object.fromEntries((nodes[2]?.fields ?? []).map((item) => [item.name, item]));
    expect(endpointIn['bEndpointAddress']?.formatted).toBe('0x81 · EP1 IN');
    expect(endpointIn['bmAttributes']?.formatted).toContain('Bulk');
    expect(endpointIn['wMaxPacketSize']?.formatted).toBe('64 B');

    const endpointOut = Object.fromEntries((nodes[3]?.fields ?? []).map((item) => [item.name, item]));
    expect(endpointOut['bEndpointAddress']?.formatted).toBe('0x01 · EP1 OUT');
  });

  it('dizgi tanımlayıcısını UTF-16LE olarak okur (§9.6.7)', () => {
    const bytes = Uint8Array.from([0x0a, 0x03, 0x41, 0x00, 0x4c, 0x00, 0x50, 0x00, 0x21, 0x00]);
    const [node] = decodeDescriptorChain(bytes);
    expect(node?.typeName).toBe('STRING');
    expect(node?.fields[0]?.value).toBe('ALP!');
  });

  it('bLength eldeki baytları aşarsa alanlar gösterilir ama truncated işaretlenir', () => {
    const truncated = DEVICE_DESCRIPTOR.slice(0, 10);
    const [node] = decodeDescriptorChain(truncated);
    expect(node?.truncated).toBe(true);
    expect(node?.fields.length).toBeGreaterThan(0);
  });

  it('bLength 0 ise yürüyüş durur (sonsuz döngü yok)', () => {
    expect(decodeDescriptorChain(Uint8Array.from([0x00, 0x01, 0x00, 0x01]))).toHaveLength(0);
  });

  it('tanımlayıcı adaylığı Table 9-5 türüne bağlıdır', () => {
    expect(isPossibleDescriptorPayload(DEVICE_DESCRIPTOR)).toBe(true);
    // 0x63 Table 9-5'te yok.
    expect(isPossibleDescriptorPayload(Uint8Array.from([0x04, 0x63, 0x00, 0x00]))).toBe(false);
    expect(isPossibleDescriptorPayload(Uint8Array.from([0x01]))).toBe(false);
  });
});
