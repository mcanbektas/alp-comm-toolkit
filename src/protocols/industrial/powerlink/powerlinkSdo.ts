/**
 * POWERLINK "SDO via ASnd" — Sequence Layer + Command Layer.
 *
 * ASnd ServiceID 5 (SDO) çerçevesinde İKİ ayrı katman üst üste durur:
 *   • Sequence Layer, çerçeve ofseti 18, 4 bayt — bağlantı/tekrar yönetimi.
 *   • Command Layer, çerçeve ofseti 22, 8 bayt sabit başlık + komuta göre
 *     değişen gövde.
 * Ofsetler İKİ KAYNAKTA BİREBİR: O (openPOWERLINK `frame.h`)
 * `PLK_FRAME_OFFSET_SDO_SEQU 18` / `PLK_FRAME_OFFSET_SDO_COMU 22` ve
 * `SDO_CMDL_HDR_FIXED_SIZE 8`; W (Wireshark `packet-epl.c`)
 * `EPL_ASND_SDO_SEQ_RECEIVE_CON_OFFSET 4` / `..._SEND_CON_OFFSET 5`
 * (ASnd'e göreli, +14 Ethernet = 18/19) ve `dissect_epl_sdo_command()`in
 * 1+1+1+1+4 = 8 baytlık ilerlemesi.
 *
 * ── CANopen SDO'suyla ORTAK DEĞİL (bit düzeyinde kanıt) ─────────────────────
 * CANopen SDO'su TEK baytlık bir "command specifier" taşır (üst 3 bit) ve
 * hemen ardından Index(2, LE) + SubIndex(1) + 4 bayt veri gelir — toplam 8
 * bayt, CAN çerçevesinin tamamı (`canopen.ts` `decodeSdoPayload`). POWERLINK'in
 * Command Layer'ı ise reserved(1) + TransactionID(1) + Flags(1) + CommandID(1)
 * + SegmentSize(2, LE) + reserved(2) = 8 BAYTLIK AYRI BİR BAŞLIKTIR; Index/
 * SubIndex bu başlığın DIŞINDA, yalnız isteklerde ve yalnız expedited/initiate
 * kipinde gelir. Ortak olan tek şey OD adreslemesinin 16-bit Index + 8-bit
 * Sub-index olması; onu paylaşmak dört satırlık bir okuma için modül açmak
 * olurdu (dalga 12'nin "spekülatif ortak modül açma" dersi).
 *
 * ── KAYNAK ──────────────────────────────────────────────────────────────────
 * W: `epan/dissectors/packet-epl.c` (GPL-2.0-or-later) — `epl_sdo_receive_con_vals`,
 *    `epl_sdo_send_con_vals`, `epl_sdo_asnd_commands`, `sdo_cmd_abort_code`,
 *    `EPL_ASND_SDO_CMD_{RESPONSE,ABORT,SEGMENTATION}_FILTER`.
 *    https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-epl.c
 * O: openPOWERLINK V2 (GPLv2/BSD çift lisans; yalnız dokümante sabitler
 *    referans alındı, KOD KOPYALANMADI) — `stack/include/oplk/frame.h`
 *    `tAsySdoCom` + `SDO_CMDL_FLAG_*`, `stack/include/user/sdocomint.h`
 *    `tSdoServiceType`, `stack/include/oplk/sdoabortcodes.h`.
 *    https://github.com/OpenAutomationTechnologies/openPOWERLINK_V2
 *
 * Abort kodu tablosu iki kaynağın KESİŞİMİdir (28 kod). Yalnız birinde geçen
 * üç kod (W'de iki tane, O'da 0x06040044) ADLANDIRILMADI —
 * `ethercat.ts`in 0xFF/"EXT" emsali.
 */

import type { ParsedField, ProtocolError } from '@/protocol-core/types';

import {
  byteAt,
  formatHex,
  pushMaskedField,
  pushNumericField,
  pushRawBlock,
  readUint16Le,
  readUint32Le,
} from './powerlinkFields';

export const ERROR_SDO_SEQUENCE_TRUNCATED = 'protocol.powerlink.error.sdoSequenceTruncated';
export const ERROR_SDO_COMMAND_TRUNCATED = 'protocol.powerlink.error.sdoCommandTruncated';

export const WARN_SDO_ABORT_CODE_NOT_NAMED = 'protocol.powerlink.warning.sdoAbortCodeNotNamed';
export const WARN_SDO_COMMAND_NOT_NAMED = 'protocol.powerlink.warning.sdoCommandNotNamed';
export const WARN_SDO_DATA_NEEDS_OBJECT_DICTIONARY =
  'protocol.powerlink.warning.sdoDataNeedsObjectDictionary';
export const WARN_SDO_SEGMENT_SIZE_MISMATCH = 'protocol.powerlink.warning.sdoSegmentSizeMismatch';
export const WARN_SDO_COMMAND_LAYER_EMPTY = 'protocol.powerlink.warning.sdoCommandLayerEmpty';

/** Sequence Layer 4 bayt (2 bayt bağlantı durumu + 2 bayt ayrılmış). */
const SEQUENCE_LAYER_LENGTH = 4;
/** Command Layer sabit başlığı (O `SDO_CMDL_HDR_FIXED_SIZE`). */
const COMMAND_HEADER_LENGTH = 8;
/** WriteByIndex/ReadByIndex isteğinin alt başlığı: Index(2) + SubIndex(1) + rsvd(1). */
const BY_INDEX_HEADER_LENGTH = 4;
const ABORT_CODE_LENGTH = 4;

const CON_MASK = 0x03;
const SEQUENCE_NUMBER_MASK = 0xfc;
const SEQUENCE_NUMBER_SHIFT = 2;

const CMD_FLAG_RESPONSE_MASK = 0x80;
const CMD_FLAG_ABORT_MASK = 0x40;
const CMD_FLAG_SEGMENTATION_MASK = 0x30;
const CMD_FLAG_SEGMENTATION_SHIFT = 4;

const SEGMENTATION_EXPEDITED = 0;
const SEGMENTATION_INITIATE = 1;

/**
 * ReceiveCon ve SendCon aynı iki biti kullanır ama 0x03'ün ANLAMI farklıdır:
 * alıcı tarafta "Error Response (retransmission request)", gönderen tarafta
 * "Connection valid with acknowledge request". İki kaynak da bu asimetriyi
 * aynen veriyor (W'nin iki ayrı `value_string`i); tek tablo yazmak sessiz-yanlış
 * bir etiket demek olurdu.
 */
const RECEIVE_CON_LABELS: readonly string[] = [
  'No connection',
  'Initialization',
  'Connection valid',
  'Error Response (retransmission request)',
];

const SEND_CON_LABELS: readonly string[] = [
  'No connection',
  'Initialization',
  'Connection valid',
  'Connection valid with acknowledge request',
];

/** İki kaynakta birebir aynı komut kimlikleri (W `epl_sdo_asnd_commands`, O `tSdoServiceType`). */
const COMMAND_LABELS: ReadonlyMap<number, string> = new Map([
  [0x00, 'NIL (no command)'],
  [0x01, 'WriteByIndex'],
  [0x02, 'ReadByIndex'],
  [0x03, 'WriteAllByIndex'],
  [0x04, 'ReadAllByIndex'],
  [0x05, 'WriteByName'],
  [0x06, 'ReadByName'],
  [0x20, 'FileWrite'],
  [0x21, 'FileRead'],
  [0x31, 'WriteMultipleParameterByIndex'],
  [0x32, 'ReadMultipleParameterByIndex'],
  [0x70, 'MaximumSegmentSize'],
]);

const SEGMENTATION_LABELS: readonly string[] = [
  'Expedited transfer',
  'Initiate segmented transfer',
  'Segment',
  'Transfer complete',
];

/**
 * İKİ KAYNAĞIN KESİŞİMİ (28 kod). Etiketler bu depoda kısaltılarak yazıldı;
 * sayısal değerler iki kaynakta da birebir aynıdır.
 */
const ABORT_CODE_LABELS: ReadonlyMap<number, string> = new Map([
  [0x05040000, 'SDO protocol timed out'],
  [0x05040001, 'Command ID not valid or unknown'],
  [0x05040002, 'Invalid block size'],
  [0x05040003, 'Invalid sequence number'],
  [0x05040005, 'Out of memory'],
  [0x06010000, 'Unsupported access to an object'],
  [0x06010001, 'Attempt to read a write-only object'],
  [0x06010002, 'Attempt to write a read-only object'],
  [0x06020000, 'Object does not exist in the object dictionary'],
  [0x06040041, 'Object cannot be mapped to the PDO'],
  [0x06040042, 'Mapped objects would exceed PDO length'],
  [0x06040043, 'General parameter incompatibility'],
  [0x06040047, 'General internal incompatibility in the device'],
  [0x06060000, 'Access failed due to a hardware error'],
  [0x06070010, 'Data type does not match, length does not match'],
  [0x06070012, 'Data type does not match, length too high'],
  [0x06070013, 'Data type does not match, length too low'],
  [0x06090011, 'Sub-index does not exist'],
  [0x06090030, 'Value range of parameter exceeded'],
  [0x06090031, 'Value of parameter written too high'],
  [0x06090032, 'Value of parameter written too low'],
  [0x06090036, 'Maximum value is less than minimum value'],
  [0x08000000, 'General error'],
  [0x08000020, 'Data cannot be transferred or stored to the application'],
  [0x08000021, 'Data cannot be transferred or stored because of local control'],
  [0x08000022, 'Data cannot be transferred or stored because of device state'],
  [0x08000023, 'Object dictionary generation failed or no object dictionary present'],
  [0x08000024, 'EDS, DCF or Concise DCF data set empty'],
]);

export interface PowerlinkSdoSummary {
  /** Özet satırında görünen kısa etiket, ör. `ReadByIndex Req 0x1006/0x00`. */
  readonly label: string;
  readonly commandId: number;
  readonly isResponse: boolean;
  readonly isAbort: boolean;
}

/**
 * `start` Sequence Layer'ın ilk baytıdır (çerçeve ofseti 18). `end` çerçevenin
 * sonu. Kesik veri hatası `errors`e, ham kalan bölge `fields`e yazılır —
 * `decodeDcpPdu`/`decodeAlarmPdu` (13e) imza deseninin aynısı.
 */
export function decodeSdoPdu(
  data: Uint8Array,
  start: number,
  end: number,
  fields: ParsedField[],
  warnings: string[],
  errors: ProtocolError[],
): PowerlinkSdoSummary | undefined {
  if (end - start < SEQUENCE_LAYER_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_SDO_SEQUENCE_TRUNCATED,
      offset: start,
      length: Math.max(0, end - start),
      details: {
        availableBytes: Math.max(0, end - start),
        requiredBytes: SEQUENCE_LAYER_LENGTH,
      },
    });
    return undefined;
  }

  decodeSequenceLayer(data, start, fields);

  const commandStart = start + SEQUENCE_LAYER_LENGTH;
  if (end - commandStart < COMMAND_HEADER_LENGTH) {
    // Yalnız Sequence Layer taşıyan çerçeve GEÇERLİDİR: bağlantı kurulum/
    // onay çerçevelerinde Command Layer boştur (W: "test if CommandField ==
    // empty"). Bu yüzden HATA değil UYARI basılır.
    warnings.push(WARN_SDO_COMMAND_LAYER_EMPTY);
    pushRawBlock(fields, data, {
      id: `sdo-command-layer-absent-${commandStart}`,
      name: 'SDO Command Layer (absent)',
      offset: commandStart,
      length: end - commandStart,
      warnings: [WARN_SDO_COMMAND_LAYER_EMPTY],
    });
    return { label: 'Sequence only', commandId: 0, isResponse: false, isAbort: false };
  }

  return decodeCommandLayer(data, commandStart, end, fields, warnings);
}

function decodeSequenceLayer(data: Uint8Array, offset: number, fields: ParsedField[]): void {
  const receiveByte = byteAt(data, offset);
  pushMaskedField(fields, data, {
    id: `sdo-receive-sequence-number-${offset}`,
    name: 'SDO Sequence — ReceiveSequenceNumber',
    offset,
    value: receiveByte,
    mask: SEQUENCE_NUMBER_MASK,
    shift: SEQUENCE_NUMBER_SHIFT,
  });
  pushMaskedField(fields, data, {
    id: `sdo-receive-con-${offset}`,
    name: 'SDO Sequence — ReceiveCon',
    offset,
    value: receiveByte,
    mask: CON_MASK,
    shift: 0,
    physicalValue: RECEIVE_CON_LABELS[receiveByte & CON_MASK] ?? '',
  });

  const sendOffset = offset + 1;
  const sendByte = byteAt(data, sendOffset);
  pushMaskedField(fields, data, {
    id: `sdo-send-sequence-number-${sendOffset}`,
    name: 'SDO Sequence — SendSequenceNumber',
    offset: sendOffset,
    value: sendByte,
    mask: SEQUENCE_NUMBER_MASK,
    shift: SEQUENCE_NUMBER_SHIFT,
  });
  pushMaskedField(fields, data, {
    id: `sdo-send-con-${sendOffset}`,
    name: 'SDO Sequence — SendCon',
    offset: sendOffset,
    value: sendByte,
    mask: CON_MASK,
    shift: 0,
    physicalValue: SEND_CON_LABELS[sendByte & CON_MASK] ?? '',
  });

  pushRawBlock(fields, data, {
    id: `sdo-sequence-reserved-${offset + 2}`,
    name: 'SDO Sequence — Reserved',
    offset: offset + 2,
    length: 2,
  });
}

function decodeCommandLayer(
  data: Uint8Array,
  start: number,
  end: number,
  fields: ParsedField[],
  warnings: string[],
): PowerlinkSdoSummary {
  pushRawBlock(fields, data, {
    id: `sdo-command-reserved-${start}`,
    name: 'SDO Command — Reserved',
    offset: start,
    length: 1,
  });

  const transactionOffset = start + 1;
  pushNumericField(fields, data, {
    id: `sdo-transaction-id-${transactionOffset}`,
    name: 'SDO Command — TransactionID',
    offset: transactionOffset,
    length: 1,
  });

  const flagsOffset = start + 2;
  const flags = byteAt(data, flagsOffset);
  const isResponse = (flags & CMD_FLAG_RESPONSE_MASK) !== 0;
  const isAbort = (flags & CMD_FLAG_ABORT_MASK) !== 0;
  const segmentation = (flags & CMD_FLAG_SEGMENTATION_MASK) >>> CMD_FLAG_SEGMENTATION_SHIFT;

  pushMaskedField(fields, data, {
    id: `sdo-flag-response-${flagsOffset}`,
    name: 'SDO Command — Response (bit 7)',
    offset: flagsOffset,
    value: flags,
    mask: CMD_FLAG_RESPONSE_MASK,
    shift: 7,
    physicalValue: isResponse ? 'Response' : 'Request',
  });
  pushMaskedField(fields, data, {
    id: `sdo-flag-abort-${flagsOffset}`,
    name: 'SDO Command — Abort (bit 6)',
    offset: flagsOffset,
    value: flags,
    mask: CMD_FLAG_ABORT_MASK,
    shift: 6,
    physicalValue: isAbort ? 'Abort transfer' : 'Transfer OK',
  });
  pushMaskedField(fields, data, {
    id: `sdo-flag-segmentation-${flagsOffset}`,
    name: 'SDO Command — Segmentation (bits 4-5)',
    offset: flagsOffset,
    value: flags,
    mask: CMD_FLAG_SEGMENTATION_MASK,
    shift: CMD_FLAG_SEGMENTATION_SHIFT,
    physicalValue: SEGMENTATION_LABELS[segmentation] ?? '',
  });

  const commandOffset = start + 3;
  const commandId = byteAt(data, commandOffset);
  const commandLabel = COMMAND_LABELS.get(commandId);
  const commandField: ParsedField = {
    id: `sdo-command-id-${commandOffset}`,
    name: 'SDO Command — CommandID',
    offset: commandOffset,
    length: 1,
    rawBytes: data.slice(commandOffset, commandOffset + 1),
    rawValue: commandId,
    physicalValue: commandLabel ?? formatHex(commandId, 2),
    valid: commandLabel !== undefined,
    warnings: [],
  };
  if (commandLabel === undefined) {
    commandField.warnings.push(WARN_SDO_COMMAND_NOT_NAMED);
    warnings.push(WARN_SDO_COMMAND_NOT_NAMED);
  }
  fields.push(commandField);

  const segmentSizeOffset = start + 4;
  const segmentSize = readUint16Le(data, segmentSizeOffset);
  const payloadStart = start + COMMAND_HEADER_LENGTH;
  const availablePayload = end - payloadStart;
  const segmentSizeWarnings: string[] = [];
  if (segmentSize > availablePayload) {
    // Bildirilen boy telde OLANDAN büyük: çerçeve kesik ya da SegmentSize
    // bozuk. Ham bölge yine basılır, ama SÖZÜ tutulmadığı söylenir.
    segmentSizeWarnings.push(WARN_SDO_SEGMENT_SIZE_MISMATCH);
    warnings.push(WARN_SDO_SEGMENT_SIZE_MISMATCH);
  }
  pushNumericField(fields, data, {
    id: `sdo-segment-size-${segmentSizeOffset}`,
    name: 'SDO Command — SegmentSize',
    offset: segmentSizeOffset,
    length: 2,
    unit: 'B',
    warnings: segmentSizeWarnings,
  });

  pushRawBlock(fields, data, {
    id: `sdo-command-reserved2-${start + 6}`,
    name: 'SDO Command — Reserved',
    offset: start + 6,
    length: 2,
  });

  if (isAbort) {
    return decodeAbort(data, payloadStart, end, fields, warnings, commandId, isResponse);
  }

  const usesByIndexHeader =
    !isResponse &&
    (commandId === 0x01 || commandId === 0x02) &&
    (segmentation === SEGMENTATION_EXPEDITED || segmentation === SEGMENTATION_INITIATE);

  let dataStart = payloadStart;
  let indexLabel = '';
  if (usesByIndexHeader && end - payloadStart >= BY_INDEX_HEADER_LENGTH) {
    const index = readUint16Le(data, payloadStart);
    pushNumericField(fields, data, {
      id: `sdo-object-index-${payloadStart}`,
      name: 'SDO — Index',
      offset: payloadStart,
      length: 2,
      physicalValue: formatHex(index, 4),
    });
    const subIndexOffset = payloadStart + 2;
    const subIndex = byteAt(data, subIndexOffset);
    pushNumericField(fields, data, {
      id: `sdo-object-sub-index-${subIndexOffset}`,
      name: 'SDO — Sub-index',
      offset: subIndexOffset,
      length: 1,
      physicalValue: formatHex(subIndex, 2),
    });
    pushRawBlock(fields, data, {
      id: `sdo-by-index-reserved-${payloadStart + 3}`,
      name: 'SDO — Reserved',
      offset: payloadStart + 3,
      length: 1,
    });
    dataStart = payloadStart + BY_INDEX_HEADER_LENGTH;
    indexLabel = ` ${formatHex(index, 4)}/${formatHex(subIndex, 2)}`;
  }

  const dataLength = end - dataStart;
  if (dataLength > 0) {
    // Verinin TİPİ ve ölçeği Object Dictionary'de yazar (XDD/EDS), çerçevede
    // DEĞİL. Uydurma bir kırılım basmak yasak — tek parça ham + gerekçe.
    pushRawBlock(fields, data, {
      id: `sdo-command-data-${dataStart}`,
      name: 'SDO Command — Data',
      offset: dataStart,
      length: dataLength,
      warnings: [WARN_SDO_DATA_NEEDS_OBJECT_DICTIONARY],
    });
    warnings.push(WARN_SDO_DATA_NEEDS_OBJECT_DICTIONARY);
  }

  const shortLabel = commandLabel ?? formatHex(commandId, 2);
  return {
    label: `${shortLabel} ${isResponse ? 'Res' : 'Req'}${indexLabel}`,
    commandId,
    isResponse,
    isAbort: false,
  };
}

function decodeAbort(
  data: Uint8Array,
  payloadStart: number,
  end: number,
  fields: ParsedField[],
  warnings: string[],
  commandId: number,
  isResponse: boolean,
): PowerlinkSdoSummary {
  if (end - payloadStart < ABORT_CODE_LENGTH) {
    pushRawBlock(fields, data, {
      id: `sdo-abort-truncated-${payloadStart}`,
      name: 'SDO — Abort Code (truncated)',
      offset: payloadStart,
      length: end - payloadStart,
      warnings: [ERROR_SDO_COMMAND_TRUNCATED],
    });
    warnings.push(ERROR_SDO_COMMAND_TRUNCATED);
    return { label: 'Abort (truncated)', commandId, isResponse, isAbort: true };
  }

  const abortCode = readUint32Le(data, payloadStart);
  const abortLabel = ABORT_CODE_LABELS.get(abortCode);
  const abortField: ParsedField = {
    id: `sdo-abort-code-${payloadStart}`,
    name: 'SDO — Abort Code',
    offset: payloadStart,
    length: ABORT_CODE_LENGTH,
    rawBytes: data.slice(payloadStart, payloadStart + ABORT_CODE_LENGTH),
    rawValue: abortCode,
    physicalValue: abortLabel ?? formatHex(abortCode, 8),
    valid: true,
    warnings: [],
  };
  if (abortLabel === undefined) {
    abortField.warnings.push(WARN_SDO_ABORT_CODE_NOT_NAMED);
    warnings.push(WARN_SDO_ABORT_CODE_NOT_NAMED);
  }
  fields.push(abortField);

  pushRawBlock(fields, data, {
    id: `sdo-abort-trailer-${payloadStart + ABORT_CODE_LENGTH}`,
    name: 'SDO — Padding',
    offset: payloadStart + ABORT_CODE_LENGTH,
    length: end - payloadStart - ABORT_CODE_LENGTH,
  });

  return {
    label: `Abort ${formatHex(abortCode, 8)}`,
    commandId,
    isResponse,
    isAbort: true,
  };
}
