import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';

import {
  buildDataPacket,
  buildSofPacket,
  buildTokenPacket,
  computeUsbDataCrc16,
  computeUsbTokenCrc5,
  decodeUsbPid,
  packTokenBytes,
  splitUsbPacket,
  USB_DATA_CRC_RESIDUAL,
  USB_PID_BYTES,
  USB_TOKEN_CRC_RESIDUAL,
} from './usbPacket';

/**
 * Spec §8.3.5'in metnine BİREBİR sadık bit-serial referans uygulama — testin
 * KENDİ bağımsız hesabı. Üretim kodundaki `computeUsbTokenCrc5` ile aynı fikri
 * paylaşır ama buradaki sürüm residual doğrulaması için ham kalanı da verir;
 * asıl doğrulama, spec'in YAYIMLADIĞI residual değerlerinin (0b01100 ve
 * 0x800D) yeniden üretilmesidir.
 */
function specRemainder(bits: readonly number[], width: number, poly: number): number {
  const mask = (1 << width) - 1;
  let remainder = mask;
  for (const bit of bits) {
    const xor = ((remainder >> (width - 1)) & 1) ^ bit;
    remainder = (remainder << 1) & mask;
    if (xor === 1) remainder ^= poly;
  }
  return remainder;
}

function bitsOfBytes(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (const byte of bytes) for (let index = 0; index < 8; index += 1) bits.push((byte >> index) & 1);
  return bits;
}

describe('USB CRC — birincil kaynaktan doğrulama', () => {
  it('token CRC5, spec §8.3.5.1 residual değerini (01100B) üretir', () => {
    const fieldValue = 0x3a | (0x0a << 7);
    const crc5 = computeUsbTokenCrc5(fieldValue);

    const bits: number[] = [];
    for (let index = 0; index < 11; index += 1) bits.push((fieldValue >> index) & 1);
    // CRC hatta MSb-first gider (§8.3.5).
    for (let index = 4; index >= 0; index -= 1) bits.push((crc5 >> index) & 1);

    expect(specRemainder(bits, 5, 0x05)).toBe(USB_TOKEN_CRC_RESIDUAL);
  });

  it('veri CRC16, spec §8.3.5.2 residual değerini (1000000000001101B) üretir', () => {
    const payload = Uint8Array.from([0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x12, 0x00]);
    const crc16 = computeUsbDataCrc16(payload);

    // CRC hatta MSb-first gider ama bayta LSb-first yerleşir; ikisinin bileşkesi
    // CRC'nin little-endian iki bayt olarak eklenmesidir (spec §8.1 + §8.3.5).
    const bits = bitsOfBytes(
      Uint8Array.from([...payload, crc16 & 0xff, (crc16 >> 8) & 0xff]),
    );

    expect(specRemainder(bits, 16, 0x8005)).toBe(USB_DATA_CRC_RESIDUAL);
  });

  it("CRC16_ARC USB veri CRC16 DEĞİLDİR (briefin doğrulanmamış adayı)", () => {
    const payload = Uint8Array.from([0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x12, 0x00]);
    expect(computeUsbDataCrc16(payload)).not.toBe(Number(computeNamedCrc(payload, 'CRC16_ARC')));
    // Katalogdaki iki girdinin check değerleri de ayrışır.
    const check = Uint8Array.from([...'123456789'].map((character) => character.charCodeAt(0)));
    expect(computeNamedCrc(check, 'CRC16_USB')).toBe(0xb4c8n);
    expect(computeNamedCrc(check, 'CRC16_ARC')).toBe(0xbb3dn);
  });

  it('bit-serial CRC5, bilinen hat dizisini (SETUP adres 0 endpoint 0 → 2D 00 10) üretir', () => {
    expect([...buildTokenPacket(USB_PID_BYTES.SETUP, 0, 0)]).toEqual([0x2d, 0x00, 0x10]);
  });

  it('CRC5 bitleri ikinci baytın 3..7 bitlerine TERS sırada yerleşir', () => {
    // 11 bitlik alan sıfır, CRC 0b11111 olsaydı ikinci baytın üst 5 biti dolardı.
    expect([...packTokenBytes(0, 0b11111)]).toEqual([0x00, 0xf8]);
    // Yalnız MSb 1 olsaydı ilk gönderilen bit, yani bit 3 dolardı.
    expect([...packTokenBytes(0, 0b10000)]).toEqual([0x00, 0x08]);
  });
});

describe('PID çözümü (Table 8-1)', () => {
  it('tanımlı PID baytlarını ada ve gruba çevirir', () => {
    expect(decodeUsbPid(USB_PID_BYTES.OUT)).toMatchObject({ name: 'OUT', group: 'token', checkValid: true });
    expect(decodeUsbPid(USB_PID_BYTES.DATA1)).toMatchObject({ name: 'DATA1', group: 'data' });
    expect(decodeUsbPid(USB_PID_BYTES.STALL)).toMatchObject({ name: 'STALL', group: 'handshake' });
    expect(decodeUsbPid(USB_PID_BYTES.PING)).toMatchObject({ name: 'PING', group: 'special' });
  });

  it('check alanı tümleyen değilse checkValid false döner (spec §8.3.1)', () => {
    expect(decodeUsbPid(0x2c).checkValid).toBe(false);
    expect(decodeUsbPid(USB_PID_BYTES.SETUP).checkValid).toBe(true);
  });

  it('PRE ve ERR aynı kodu paylaşır — tek isim taşınır', () => {
    expect(decodeUsbPid(0x3c).name).toBe('PRE/ERR');
  });
});

describe('paket iskeleti', () => {
  it('token paketini adres/endpoint/CRC5 olarak ayırır', () => {
    const packet = buildTokenPacket(USB_PID_BYTES.IN, 0x3a, 0x0a);
    const structure = splitUsbPacket(packet);

    expect(structure.kind).toBe('token');
    expect(structure.token).toMatchObject({ address: 0x3a, endpoint: 0x0a, crc5Valid: true });
    expect(structure.trailingBytes).toHaveLength(0);
  });

  it('SOF paketini frame number olarak ayırır', () => {
    const structure = splitUsbPacket(buildSofPacket(USB_PID_BYTES.SOF, 0x64));
    expect(structure.kind).toBe('sof');
    expect(structure.sof).toMatchObject({ frameNumber: 0x64, crc5Valid: true });
  });

  it('11 bitlik frame number sınırında (0x7FF) çözüm bozulmaz', () => {
    const structure = splitUsbPacket(buildSofPacket(USB_PID_BYTES.SOF, 0x7ff));
    expect(structure.sof?.frameNumber).toBe(0x7ff);
    expect(structure.sof?.crc5Valid).toBe(true);
  });

  it("veri paketinde yükü ve CRC16 alanını ayırır", () => {
    const payload = Uint8Array.from([0xde, 0xad, 0xbe, 0xef]);
    const structure = splitUsbPacket(buildDataPacket(USB_PID_BYTES.DATA0, payload));

    expect(structure.kind).toBe('data');
    expect([...(structure.data?.payload ?? [])]).toEqual([...payload]);
    expect(structure.data?.crc16Valid).toBe(true);
  });

  it('yüksüz veri paketi (zero-length data) geçerli sayılır', () => {
    const structure = splitUsbPacket(buildDataPacket(USB_PID_BYTES.DATA1, new Uint8Array(0)));
    expect(structure.data?.payload).toHaveLength(0);
    expect(structure.data?.crc16Valid).toBe(true);
  });

  it('bozuk CRC16 yakalanır', () => {
    const packet = buildDataPacket(USB_PID_BYTES.DATA0, Uint8Array.from([0x01, 0x02]));
    packet[packet.length - 1] = (packet[packet.length - 1] ?? 0) ^ 0xff;
    expect(splitUsbPacket(packet).data?.crc16Valid).toBe(false);
  });

  it("handshake paketi tek bayttır, fazlası trailingBytes alanına düşer", () => {
    const structure = splitUsbPacket(Uint8Array.from([USB_PID_BYTES.ACK, 0x99]));
    expect(structure.kind).toBe('handshake');
    expect([...structure.trailingBytes]).toEqual([0x99]);
    expect(structure.lengthMismatch).toBe(1);
  });

  it('token 3 bayttan kısaysa alanlar kaybolmaz, lengthMismatch negatif olur', () => {
    const structure = splitUsbPacket(Uint8Array.from([USB_PID_BYTES.OUT, 0x05]));
    expect(structure.lengthMismatch).toBe(-1);
    expect(structure.token).toBeDefined();
  });

  it("CRC16 için yeterli bayt yoksa eldeki baytlar trailingBytes alanına düşer", () => {
    const structure = splitUsbPacket(Uint8Array.from([USB_PID_BYTES.DATA0, 0x11]));
    expect(structure.data).toBeUndefined();
    expect([...structure.trailingBytes]).toEqual([0x11]);
  });

  it('rezerve PID unknown türüne düşer', () => {
    expect(splitUsbPacket(Uint8Array.from([0xf0])).kind).toBe('unknown');
  });
});
