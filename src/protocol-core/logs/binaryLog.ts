/**
 * Ham ikili dosya (spec §34 "BIN"). İkili bir dökümde ÇERÇEVE SINIRI YOKTUR:
 * dosya yalnız bayt dizisidir, nerede bittiğini söyleyen bir üstbilgi taşımaz.
 *
 * Bu yüzden iki davranış var ve ikisi de kullanıcının kararına bağlı:
 *  · `frameLength` verilmezse dosyanın TAMAMI tek bir kayıt olur. Bölme
 *    uydurulmaz — sabit 8 bayt varsaymak, 8 baytlık olmayan her dosyada
 *    inandırıcı ama yanlış bir çerçeve listesi üretirdi.
 *  · `frameLength` verilirse dosya o boyda dilimlenir; son dilim eksik
 *    kalabilir ve `truncated` işaretlenir.
 *
 * Ayraç/uzunluk alanına göre çerçeve çıkarımı `protocol-core/framing`in işi;
 * o motor bu katmana Log Analyzer'ın ilerideki bir dalgasında bağlanacak.
 */

import type { LogParseOptions, LogParseResult, LogRecord } from './types';
import { DEFAULT_MAX_LOG_RECORDS } from './types';
import { createWarningCollector } from './warnings';

export interface BinaryLogOptions extends LogParseOptions {
  /** Sabit çerçeve boyu (bayt); verilmezse dosya tek kayıt olur. */
  readonly frameLength?: number;
}

export function parseBinaryLog(buffer: Uint8Array, options: BinaryLogOptions = {}): LogParseResult {
  if (buffer.length === 0) {
    return { status: 'error', code: 'empty-input', message: 'Dosya boş.' };
  }

  const maxRecords = options.maxRecords ?? DEFAULT_MAX_LOG_RECORDS;
  const frameLength = options.frameLength;
  const warnings = createWarningCollector();

  if (frameLength === undefined || frameLength <= 0) {
    const record: LogRecord = {
      index: 0,
      line: undefined,
      timestamp: undefined,
      direction: undefined,
      channel: undefined,
      frameId: undefined,
      frameIdValue: undefined,
      data: buffer,
      originalLength: buffer.length,
      flags: [],
    };
    return {
      status: 'ok',
      summary: {
        format: 'binary',
        timestampKind: 'none',
        recordCount: 1,
        totalLines: undefined,
        skippedLines: 0,
        limitReached: false,
        detail: `${buffer.length} bayt · çerçeve boyu verilmedi, dosya tek kayıt`,
      },
      records: [record],
      warnings: warnings.list(),
    };
  }

  const records: LogRecord[] = [];
  let limitReached = false;
  for (let offset = 0; offset < buffer.length; offset += frameLength) {
    if (records.length >= maxRecords) {
      limitReached = true;
      warnings.add('record-limit', `Kayıt sınırına (${maxRecords}) ulaşıldı, dosyanın kalanı okunmadı.`);
      break;
    }
    const end = Math.min(offset + frameLength, buffer.length);
    const short = end - offset < frameLength;
    if (short) {
      warnings.add('truncated-packet', `Son dilim eksik: ${end - offset} bayt, beklenen ${frameLength}.`);
    }
    records.push({
      index: records.length,
      line: undefined,
      timestamp: undefined,
      direction: undefined,
      channel: undefined,
      frameId: undefined,
      frameIdValue: undefined,
      data: buffer.subarray(offset, end),
      originalLength: frameLength,
      flags: short ? ['truncated'] : [],
    });
  }

  return {
    status: 'ok',
    summary: {
      format: 'binary',
      timestampKind: 'none',
      recordCount: records.length,
      totalLines: undefined,
      skippedLines: 0,
      limitReached,
      detail: `${buffer.length} bayt · sabit ${frameLength} baytlık çerçeveler`,
    },
    records,
    warnings: warnings.list(),
  };
}
