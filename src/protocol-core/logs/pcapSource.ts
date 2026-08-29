/**
 * PCAP dosyalarını Log Analyzer'ın ortak kayıt modeline bağlayan adaptör
 * (spec §34 "PCAP"). Ayrıştırmanın kendisi `../capture/pcap.ts`tedir ve
 * BURADA TEKRARLANMAZ — bu dosya yalnız `PcapPacket` → `LogRecord`
 * çevirisidir. `pcap.ts` yazıldığı dalgada bilerek tüketicisiz bırakılmıştı
 * (dosya başındaki nota bakın: "UI entegrasyonu Log Analyzer'ın işi").
 *
 * Çeviride kaybolmaması gereken tek şey KESİLME bilgisidir: `snaplen`
 * yüzünden kısaltılmış paketin `data.length`i telde geçen uzunluktan küçüktür.
 * `originalLength` telde geçeni taşır, `truncated` bayrağı da ayrıca konur —
 * ikisi olmadan istatistik "ortalama paket boyu"nu olduğundan küçük gösterirdi.
 */

import { parsePcapFile } from '../capture/pcap';
import type { LogParseOptions, LogParseResult, LogRecord } from './types';
import { DEFAULT_MAX_LOG_RECORDS } from './types';
import { createWarningCollector } from './warnings';

export function parsePcapLog(buffer: Uint8Array, options: LogParseOptions = {}): LogParseResult {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_LOG_RECORDS;
  const parsed = parsePcapFile(buffer);
  if (parsed.status === 'error') {
    return {
      status: 'error',
      code: parsed.code === 'pcapng-not-supported' ? 'unsupported-format' : 'source-error',
      message: parsed.message,
    };
  }

  const warnings = createWarningCollector();
  const limitReached = parsed.packets.length > maxRecords;
  if (limitReached) {
    warnings.add('record-limit', `Kayıt sınırına (${maxRecords}) ulaşıldı, dosyanın kalanı okunmadı.`);
  }

  const packets = limitReached ? parsed.packets.slice(0, maxRecords) : parsed.packets;
  const records: LogRecord[] = packets.map((packet, index) => {
    if (packet.truncated) {
      warnings.add(
        'truncated-packet',
        `Yakalama kesilmiş paket içeriyor: ${packet.capturedLength} bayt kaydedilmiş, telde ${packet.originalLength} bayt.`,
      );
    }
    return {
      index,
      line: undefined,
      timestamp: packet.timestamp,
      direction: undefined,
      channel: parsed.header.linkTypeName,
      frameId: undefined,
      frameIdValue: undefined,
      data: packet.data,
      originalLength: packet.originalLength,
      flags: packet.truncated ? ['truncated'] : [],
    };
  });

  if (records.length === 0) {
    return { status: 'error', code: 'no-records', message: 'PCAP dosyasında paket yok.' };
  }

  const linkLabel = parsed.header.linkTypeName ?? `link-type ${parsed.header.linkType}`;
  return {
    status: 'ok',
    summary: {
      format: 'pcap',
      timestampKind: 'absolute',
      recordCount: records.length,
      totalLines: undefined,
      skippedLines: 0,
      limitReached,
      detail: `${linkLabel} · ${parsed.header.endianness === 'big' ? 'big-endian' : 'little-endian'} · snaplen ${parsed.header.snaplen}`,
    },
    records,
    warnings: warnings.list(),
  };
}
