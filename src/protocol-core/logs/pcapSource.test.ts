import { describe, expect, it } from 'vitest';

import { parsePcapLog } from './pcapSource';
import { bytesToHex } from '../buffers/representation';

const GLOBAL_HEADER_LENGTH = 24;
const PACKET_HEADER_LENGTH = 16;

interface PacketInit {
  readonly seconds: number;
  readonly microseconds: number;
  readonly data: readonly number[];
  readonly originalLength?: number;
}

/** Küçük-uçlu, mikrosaniye çözünürlüklü klasik pcap dosyası üretir (magic D4C3B2A1). */
function buildPcap(packets: readonly PacketInit[], linkType = 1): Uint8Array {
  const totalLength =
    GLOBAL_HEADER_LENGTH + packets.reduce((sum, packet) => sum + PACKET_HEADER_LENGTH + packet.data.length, 0);
  const bytes = new Uint8Array(totalLength);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0xa1b2c3d4, true); // dosyaya D4 C3 B2 A1 sırasıyla yazılır
  view.setUint16(4, 2, true);
  view.setUint16(6, 4, true);
  view.setInt32(8, 0, true);
  view.setUint32(12, 0, true);
  view.setUint32(16, 65_535, true);
  view.setUint32(20, linkType, true);

  let offset = GLOBAL_HEADER_LENGTH;
  for (const packet of packets) {
    view.setUint32(offset, packet.seconds, true);
    view.setUint32(offset + 4, packet.microseconds, true);
    view.setUint32(offset + 8, packet.data.length, true);
    view.setUint32(offset + 12, packet.originalLength ?? packet.data.length, true);
    bytes.set(packet.data, offset + PACKET_HEADER_LENGTH);
    offset += PACKET_HEADER_LENGTH + packet.data.length;
  }
  return bytes;
}

describe('parsePcapLog', () => {
  it('paketleri epoch damgalı kayda çevirir', () => {
    const result = parsePcapLog(buildPcap([{ seconds: 1_637_856_000, microseconds: 500_000, data: [0xde, 0xad] }]));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.summary.timestampKind).toBe('absolute');
    expect(result.records[0]?.timestamp).toBe(1_637_856_000_500);
    expect(bytesToHex(result.records[0]?.data ?? new Uint8Array(0))).toBe('DEAD');
    expect(result.records[0]?.channel).toBe('Ethernet');
  });

  it('kesilmiş pakette telde geçen uzunluğu saklar ve bayrak koyar', () => {
    const result = parsePcapLog(
      buildPcap([{ seconds: 1, microseconds: 0, data: [0x01, 0x02], originalLength: 1514 }]),
    );
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    const record = result.records[0];
    expect(record?.data).toHaveLength(2);
    expect(record?.originalLength).toBe(1514);
    expect(record?.flags).toContain('truncated');
    expect(result.warnings.some((warning) => warning.code === 'truncated-packet')).toBe(true);
  });

  it('bilinmeyen link-type için künyeye ham değeri yazar', () => {
    const result = parsePcapLog(buildPcap([{ seconds: 1, microseconds: 0, data: [0xaa] }], 250));
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.summary.detail).toContain('link-type 250');
  });

  it('kayıt sınırını uygular', () => {
    const packets = Array.from({ length: 5 }, (_unused, index) => ({
      seconds: 1,
      microseconds: index,
      data: [0xaa],
    }));
    const result = parsePcapLog(buildPcap(packets), { maxRecords: 2 });
    if (result.status !== 'ok') throw new Error('ayrıştırma başarısız');
    expect(result.records).toHaveLength(2);
    expect(result.summary.limitReached).toBe(true);
  });

  it('PCAPNG dosyasını desteklenmeyen biçim olarak reddeder', () => {
    const pcapng = new Uint8Array([0x0a, 0x0d, 0x0d, 0x0a, 0, 0, 0, 0]);
    const result = parsePcapLog(pcapng);
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe('unsupported-format');
  });
});
