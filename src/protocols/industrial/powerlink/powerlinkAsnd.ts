/**
 * POWERLINK ASnd (Asynchronous Send) servisleri — ServiceID'ye göre dallanan
 * altı gövde. ServiceID çerçeve ofseti 17'de, gövde 18'de başlar (W
 * `EPL_ASND_SVID_OFFSET 3` / `EPL_ASND_DATA_OFFSET 4`, ASnd'e göreli + 14
 * Ethernet başlığı; O `frame.h`in her yapısında "(Offset 18)" yorumu).
 *
 * ── KAYNAK ──────────────────────────────────────────────────────────────────
 * W: Wireshark `epan/dissectors/packet-epl.c` (GPL-2.0-or-later) —
 *    `asnd_svid_vals`, `asnd_cid_vals`, `dissect_epl_asnd_{ires,sres,nmtcmd,
 *    nmtreq,resp}()`.
 * O: openPOWERLINK V2 `stack/include/oplk/frame.h` — `tIdentResponse`,
 *    `tStatusResponse`, `tErrHistoryEntry`, `tNmtCommandService`,
 *    `tSyncResponse`, `PLK_FRAME_FLAG*` maskeleri (KOD KOPYALANMADI).
 *
 * ── İKİ KAYNAĞIN ÇAKIŞTIĞI TEK YER: IdentResponse'un IP ALANLARI ────────────
 * W bu üç alanı `tvb_get_ntohl()` ile BIG-ENDIAN okur
 * (`hf_epl_asnd_identresponse_{ipa,snm,gtw}` FT_IPv4);
 * O ise `dllkframe.c:926-930`de `ami_setUint32Le()` ile LITTLE-ENDIAN yazar
 * (alan adları da `ipAddressLe`/`subnetMaskLe`/`defaultGatewayLe`).
 * İki bağımsız kaynak bayt sırasında ANLAŞMIYOR — bu depoda kurulu ölçüt gereği
 * (çakışma → ham bırak + uyar) bu üç alan bir IP metnine ÇEVRİLMEZ, 4 baytlık
 * ham blok olarak basılır ve `WARN_IP_FIELD_BYTE_ORDER_CONFLICT` işaretlenir.
 * Yanlış yönde okunmuş bir IP, ham baytlardan ÇOK daha kötüdür: kullanıcı ona
 * güvenir.
 *
 * ── TEK KAYNAKLI OLDUĞU İÇİN ADLANDIRILMADI ─────────────────────────────────
 *  • `IdentResponseFlags` (ofset 21): yalnız O'da adı var, W bu baytı atlıyor.
 *    Bayt basılır, adı verilir ama `WARN_SINGLE_SOURCE_FIELD` taşır.
 *  • StaticErrorBitField'in İÇ kırılımı (ErrorRegister + DeviceSpecific):
 *    yalnız W veriyor, O tek bir `staticErrorLe` (U64) sayıyor. Sekiz baytlık
 *    blok TEK PARÇA basılır.
 *  • FeatureFlags'in 22 biti: yalnız W adlandırıyor. U32 ham/hex basılır.
 */

import type { ParsedField, ProtocolError } from '@/protocol-core/types';

import {
  byteAt,
  describeNmtState,
  describeNodeId,
  formatHex,
  formatVersionNibbles,
  pushBitField,
  pushMaskedField,
  pushNumericField,
  pushRawBlock,
  readUint16Le,
  readUint32Le,
} from './powerlinkFields';
import { decodeSdoPdu } from './powerlinkSdo';

export const ERROR_ASND_BODY_TRUNCATED = 'protocol.powerlink.error.asndBodyTruncated';

export const WARN_ASND_SERVICE_NOT_NAMED = 'protocol.powerlink.warning.asndServiceNotNamed';
export const WARN_ASND_SERVICE_BODY_NOT_DECODED =
  'protocol.powerlink.warning.asndServiceBodyNotDecoded';
export const WARN_IP_FIELD_BYTE_ORDER_CONFLICT =
  'protocol.powerlink.warning.ipFieldByteOrderConflict';
export const WARN_SINGLE_SOURCE_FIELD = 'protocol.powerlink.warning.singleSourceField';
export const WARN_STATIC_ERROR_FIELD_NOT_SPLIT =
  'protocol.powerlink.warning.staticErrorFieldNotSplit';
export const WARN_NMT_COMMAND_NOT_NAMED = 'protocol.powerlink.warning.nmtCommandNotNamed';
export const WARN_NMT_COMMAND_DATA_NOT_DECODED =
  'protocol.powerlink.warning.nmtCommandDataNotDecoded';
export const WARN_NMT_STATE_NOT_NAMED = 'protocol.powerlink.warning.nmtStateNotNamed';
export const WARN_ERROR_HISTORY_TRAILING_BYTES =
  'protocol.powerlink.warning.errorHistoryTrailingBytes';

const SERVICE_IDENT_RESPONSE = 0x01;
const SERVICE_STATUS_RESPONSE = 0x02;
const SERVICE_NMT_REQUEST = 0x03;
const SERVICE_NMT_COMMAND = 0x04;
const SERVICE_SDO = 0x05;
const SERVICE_SYNC_RESPONSE = 0x06;

/** İki kaynakta birebir (W `asnd_svid_vals`, O `frame.h` ASnd birleşimi). */
const SERVICE_LABELS: ReadonlyMap<number, string> = new Map([
  [SERVICE_IDENT_RESPONSE, 'IdentResponse'],
  [SERVICE_STATUS_RESPONSE, 'StatusResponse'],
  [SERVICE_NMT_REQUEST, 'NMTRequest'],
  [SERVICE_NMT_COMMAND, 'NMTCommand'],
  [SERVICE_SDO, 'SDO'],
  [SERVICE_SYNC_RESPONSE, 'SyncResponse'],
]);

/**
 * NMT komut kimlikleri — W `asnd_cid_vals`in NMT bandı; O `nmt.h`
 * `tNmtCommand` aynı sayısal kümeyi taşır. Yalnız iki kaynakta da geçenler.
 */
const NMT_COMMAND_LABELS: ReadonlyMap<number, string> = new Map([
  [0x21, 'NMTStartNode'],
  [0x22, 'NMTStopNode'],
  [0x23, 'NMTEnterPreOperational2'],
  [0x24, 'NMTEnableReadyToOperate'],
  [0x28, 'NMTResetNode'],
  [0x29, 'NMTResetCommunication'],
  [0x2a, 'NMTResetConfiguration'],
  [0x2b, 'NMTSwReset'],
  [0x41, 'NMTStartNodeEx'],
  [0x42, 'NMTStopNodeEx'],
  [0x43, 'NMTEnterPreOperational2Ex'],
  [0x44, 'NMTEnableReadyToOperateEx'],
  [0x48, 'NMTResetNodeEx'],
  [0x49, 'NMTResetCommunicationEx'],
  [0x4a, 'NMTResetConfigurationEx'],
  [0x4b, 'NMTSwResetEx'],
  [0x62, 'NMTNetHostNameSet'],
  [0x63, 'NMTFlushArpEntry'],
  [0x80, 'NMTPublishConfiguredNodes'],
  [0x90, 'NMTPublishActiveNodes'],
  [0x91, 'NMTPublishPreOperational1'],
  [0x92, 'NMTPublishPreOperational2'],
  [0x93, 'NMTPublishReadyToOperate'],
  [0x94, 'NMTPublishOperational'],
  [0x95, 'NMTPublishStopped'],
  [0xa0, 'NMTPublishEmergencyNew'],
  [0xb0, 'NMTPublishTime'],
  [0xff, 'NMTInvalidService'],
]);

/** ASnd flag1/flag2 maskeleri — W `EPL_ASND_*_MASK`, O `PLK_FRAME_FLAG*`. */
const FLAG1_EC_MASK = 0x08;
const FLAG1_EN_MASK = 0x10;
const FLAG2_RS_MASK = 0x07;
const FLAG2_PR_MASK = 0x38;
const FLAG2_PR_SHIFT = 3;
const FLAG2_SLS_MASK = 0x40;
const FLAG2_FLS_MASK = 0x80;

/** Bir hata geçmişi girdisi: EntryType(2) + ErrorCode(2) + TimeStamp(8) + AddInfo(8). */
const ERROR_ENTRY_LENGTH = 20;
const ENTRY_TYPE_PROFILE_MASK = 0x0fff;
const ENTRY_TYPE_MODE_MASK = 0x3000;
const ENTRY_TYPE_MODE_SHIFT = 12;
const ENTRY_TYPE_EMCY_MASK = 0x4000;
const ENTRY_TYPE_STATUS_MASK = 0x8000;

/** O `ERR_ENTRYTYPE_MODE_*`; W `hf_..._el_entry_type_mode` aynı iki biti okur. */
const ENTRY_MODE_LABELS: readonly string[] = ['Cleared/none', 'Active', 'Cleared', 'Occurred'];

export interface PowerlinkAsndSummary {
  readonly serviceId: number;
  readonly serviceLabel: string;
  /** Özet satırına eklenen ayrıntı (NMT komutu, SDO etiketi …); yoksa boş. */
  readonly detail: string;
}

/**
 * `start` ServiceID baytıdır (çerçeve ofseti 17). `isFromManagingNode` NMT
 * durum baytının MS_/CS_ önekini seçer; kaynak node id'sinden gelir.
 */
export function decodeAsndPdu(
  data: Uint8Array,
  start: number,
  end: number,
  isFromManagingNode: boolean,
  fields: ParsedField[],
  warnings: string[],
  errors: ProtocolError[],
): PowerlinkAsndSummary | undefined {
  if (end - start < 1) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_ASND_BODY_TRUNCATED,
      offset: start,
      length: Math.max(0, end - start),
    });
    return undefined;
  }

  const serviceId = byteAt(data, start);
  const serviceLabel = SERVICE_LABELS.get(serviceId);
  const serviceField: ParsedField = {
    id: `asnd-service-id-${start}`,
    name: 'ASnd — ServiceID',
    offset: start,
    length: 1,
    rawBytes: data.slice(start, start + 1),
    rawValue: serviceId,
    physicalValue: serviceLabel ?? describeUnnamedService(serviceId),
    valid: serviceLabel !== undefined,
    warnings: [],
  };
  if (serviceLabel === undefined) {
    serviceField.warnings.push(WARN_ASND_SERVICE_NOT_NAMED);
    warnings.push(WARN_ASND_SERVICE_NOT_NAMED);
  }
  fields.push(serviceField);

  const bodyStart = start + 1;
  const label = serviceLabel ?? formatHex(serviceId, 2);

  switch (serviceId) {
    case SERVICE_IDENT_RESPONSE:
      return {
        serviceId,
        serviceLabel: label,
        detail: decodeIdentResponse(data, bodyStart, end, isFromManagingNode, fields, warnings),
      };
    case SERVICE_STATUS_RESPONSE:
      return {
        serviceId,
        serviceLabel: label,
        detail: decodeStatusResponse(data, bodyStart, end, isFromManagingNode, fields, warnings),
      };
    case SERVICE_NMT_REQUEST:
      return {
        serviceId,
        serviceLabel: label,
        detail: decodeNmtRequest(data, bodyStart, end, fields, warnings),
      };
    case SERVICE_NMT_COMMAND:
      return {
        serviceId,
        serviceLabel: label,
        detail: decodeNmtCommand(data, bodyStart, end, fields, warnings),
      };
    case SERVICE_SDO: {
      const sdo = decodeSdoPdu(data, bodyStart, end, fields, warnings, errors);
      return { serviceId, serviceLabel: label, detail: sdo?.label ?? '' };
    }
    case SERVICE_SYNC_RESPONSE:
      decodeSyncResponse(data, bodyStart, end, fields);
      return { serviceId, serviceLabel: label, detail: '' };
    default:
      // Adı olmayan ya da üretici-özgü ServiceID: gövde bu motorun kapsamı
      // DIŞINDA. Ham basılır ve NEDENİ söylenir ("boş kart basmak yasak").
      pushRawBlock(fields, data, {
        id: `asnd-payload-${bodyStart}`,
        name: 'ASnd — Payload',
        offset: bodyStart,
        length: end - bodyStart,
        warnings: [WARN_ASND_SERVICE_BODY_NOT_DECODED],
      });
      warnings.push(WARN_ASND_SERVICE_BODY_NOT_DECODED);
      return { serviceId, serviceLabel: label, detail: '' };
  }
}

/** 0xA0-0xFE bandı üretici-özgüdür; iki kaynak da bunu böyle veriyor. */
function describeUnnamedService(serviceId: number): string {
  if (serviceId >= 0xa0 && serviceId <= 0xfe) return 'Manufacturer specific';
  return formatHex(serviceId, 2);
}

/** IdentResponse ve StatusResponse aynı flag1/flag2 çiftiyle başlar. */
function decodeResponseFlags(
  data: Uint8Array,
  offset: number,
  fields: ParsedField[],
  prefix: string,
): void {
  const flag1 = byteAt(data, offset);
  pushBitField(fields, data, {
    id: `${prefix}-flag-en-${offset}`,
    name: `${prefix === 'ires' ? 'IdentResponse' : 'StatusResponse'} — EN (exception new)`,
    offset,
    value: flag1,
    mask: FLAG1_EN_MASK,
    onLabel: 'Set',
    offLabel: 'Not set',
  });
  pushBitField(fields, data, {
    id: `${prefix}-flag-ec-${offset}`,
    name: `${prefix === 'ires' ? 'IdentResponse' : 'StatusResponse'} — EC (exception clear)`,
    offset,
    value: flag1,
    mask: FLAG1_EC_MASK,
    onLabel: 'Set',
    offLabel: 'Not set',
  });

  const flag2Offset = offset + 1;
  const flag2 = byteAt(data, flag2Offset);
  pushMaskedField(fields, data, {
    id: `${prefix}-flag-pr-${flag2Offset}`,
    name: 'PR (priority of requested asynchronous frame)',
    offset: flag2Offset,
    value: flag2,
    mask: FLAG2_PR_MASK,
    shift: FLAG2_PR_SHIFT,
  });
  pushMaskedField(fields, data, {
    id: `${prefix}-flag-rs-${flag2Offset}`,
    name: 'RS (pending requests to send)',
    offset: flag2Offset,
    value: flag2,
    mask: FLAG2_RS_MASK,
    shift: 0,
  });
  pushBitField(fields, data, {
    id: `${prefix}-flag-fls-${flag2Offset}`,
    name: 'FLS (first valid loss)',
    offset: flag2Offset,
    value: flag2,
    mask: FLAG2_FLS_MASK,
    onLabel: 'Set',
    offLabel: 'Not set',
  });
  pushBitField(fields, data, {
    id: `${prefix}-flag-sls-${flag2Offset}`,
    name: 'SLS (second valid loss)',
    offset: flag2Offset,
    value: flag2,
    mask: FLAG2_SLS_MASK,
    onLabel: 'Set',
    offLabel: 'Not set',
  });
}

/** NMT durum baytı — üç yerde (PRes, SoA, ASnd) aynı biçimde okunur. */
export function pushNmtStateField(
  data: Uint8Array,
  offset: number,
  isManagingNode: boolean,
  fields: ParsedField[],
  warnings: string[],
  id: string,
  name: string,
): string {
  const state = byteAt(data, offset);
  const described = describeNmtState(state, isManagingNode);
  const field: ParsedField = {
    id,
    name,
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: state,
    physicalValue: described.label,
    valid: described.known,
    warnings: [],
  };
  if (!described.known) {
    field.warnings.push(WARN_NMT_STATE_NOT_NAMED);
    warnings.push(WARN_NMT_STATE_NOT_NAMED);
  }
  fields.push(field);
  return described.label;
}

function decodeIdentResponse(
  data: Uint8Array,
  start: number,
  end: number,
  isFromManagingNode: boolean,
  fields: ParsedField[],
  warnings: string[],
): string {
  decodeResponseFlags(data, start, fields, 'ires');

  const nmtOffset = start + 2;
  const stateLabel = pushNmtStateField(
    data,
    nmtOffset,
    isFromManagingNode,
    fields,
    warnings,
    `ires-nmt-status-${nmtOffset}`,
    'IdentResponse — NMTStatus',
  );

  // Ofset 21: yalnız openPOWERLINK adlandırıyor (W bu baytı atlıyor).
  pushNumericField(fields, data, {
    id: `ires-flags-${start + 3}`,
    name: 'IdentResponse — IdentResponseFlags',
    offset: start + 3,
    length: 1,
    warnings: [WARN_SINGLE_SOURCE_FIELD],
  });
  warnings.push(WARN_SINGLE_SOURCE_FIELD);

  const versionOffset = start + 4;
  const version = byteAt(data, versionOffset);
  pushNumericField(fields, data, {
    id: `ires-powerlink-version-${versionOffset}`,
    name: 'IdentResponse — POWERLINKVersion',
    offset: versionOffset,
    length: 1,
    physicalValue: formatVersionNibbles(version),
  });
  pushRawBlock(fields, data, {
    id: `ires-reserved-${start + 5}`,
    name: 'IdentResponse — Reserved',
    offset: start + 5,
    length: 1,
  });

  const featureOffset = start + 6;
  const featureFlags = readUint32Le(data, featureOffset);
  pushNumericField(fields, data, {
    id: `ires-feature-flags-${featureOffset}`,
    name: 'IdentResponse — FeatureFlags',
    offset: featureOffset,
    length: 4,
    physicalValue: formatHex(featureFlags, 8),
  });

  pushNumericField(fields, data, {
    id: `ires-mtu-${start + 10}`,
    name: 'IdentResponse — MTU',
    offset: start + 10,
    length: 2,
    unit: 'B',
  });
  pushNumericField(fields, data, {
    id: `ires-poll-in-size-${start + 12}`,
    name: 'IdentResponse — PollInSize',
    offset: start + 12,
    length: 2,
    unit: 'B',
  });
  pushNumericField(fields, data, {
    id: `ires-poll-out-size-${start + 14}`,
    name: 'IdentResponse — PollOutSize',
    offset: start + 14,
    length: 2,
    unit: 'B',
  });
  pushNumericField(fields, data, {
    id: `ires-response-time-${start + 16}`,
    name: 'IdentResponse — ResponseTime',
    offset: start + 16,
    length: 4,
    unit: 'ns',
  });
  pushRawBlock(fields, data, {
    id: `ires-reserved2-${start + 20}`,
    name: 'IdentResponse — Reserved',
    offset: start + 20,
    length: 2,
  });

  const identityFields: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly delta: number;
  }> = [
    { id: 'device-type', name: 'DeviceType', delta: 22 },
    { id: 'vendor-id', name: 'VendorId', delta: 26 },
    { id: 'product-code', name: 'ProductCode', delta: 30 },
    { id: 'revision-number', name: 'RevisionNumber', delta: 34 },
    { id: 'serial-number', name: 'SerialNumber', delta: 38 },
  ];
  for (const entry of identityFields) {
    const offset = start + entry.delta;
    const value = readUint32Le(data, offset);
    pushNumericField(fields, data, {
      id: `ires-${entry.id}-${offset}`,
      name: `IdentResponse — ${entry.name}`,
      offset,
      length: 4,
      physicalValue: formatHex(value, 8),
    });
  }

  pushRawBlock(fields, data, {
    id: `ires-vendor-specific-1-${start + 42}`,
    name: 'IdentResponse — VendorSpecificExt1',
    offset: start + 42,
    length: 8,
  });

  const timeFields: ReadonlyArray<{ readonly id: string; readonly name: string; readonly delta: number }> =
    [
      { id: 'verify-configuration-date', name: 'VerifyConfigurationDate', delta: 50 },
      { id: 'verify-configuration-time', name: 'VerifyConfigurationTime', delta: 54 },
      { id: 'application-sw-date', name: 'ApplicationSwDate', delta: 58 },
      { id: 'application-sw-time', name: 'ApplicationSwTime', delta: 62 },
    ];
  for (const entry of timeFields) {
    const offset = start + entry.delta;
    pushNumericField(fields, data, {
      id: `ires-${entry.id}-${offset}`,
      name: `IdentResponse — ${entry.name}`,
      offset,
      length: 4,
    });
  }

  // İki kaynak bayt sırasında ÇAKIŞIYOR → ham (dosya başı).
  const ipFields: ReadonlyArray<{ readonly id: string; readonly name: string; readonly delta: number }> =
    [
      { id: 'ip-address', name: 'IPAddress', delta: 66 },
      { id: 'subnet-mask', name: 'SubnetMask', delta: 70 },
      { id: 'default-gateway', name: 'DefaultGateway', delta: 74 },
    ];
  for (const entry of ipFields) {
    const offset = start + entry.delta;
    pushRawBlock(fields, data, {
      id: `ires-${entry.id}-${offset}`,
      name: `IdentResponse — ${entry.name}`,
      offset,
      length: 4,
      warnings: [WARN_IP_FIELD_BYTE_ORDER_CONFLICT],
    });
  }
  warnings.push(WARN_IP_FIELD_BYTE_ORDER_CONFLICT);

  const hostNameOffset = start + 78;
  pushRawBlock(fields, data, {
    id: `ires-host-name-${hostNameOffset}`,
    name: 'IdentResponse — HostName',
    offset: hostNameOffset,
    length: Math.min(32, Math.max(0, end - hostNameOffset)),
  });
  const vendorExt2Offset = start + 110;
  pushRawBlock(fields, data, {
    id: `ires-vendor-specific-2-${vendorExt2Offset}`,
    name: 'IdentResponse — VendorSpecificExt2',
    offset: vendorExt2Offset,
    length: Math.max(0, end - vendorExt2Offset),
  });

  return stateLabel;
}

function decodeStatusResponse(
  data: Uint8Array,
  start: number,
  end: number,
  isFromManagingNode: boolean,
  fields: ParsedField[],
  warnings: string[],
): string {
  decodeResponseFlags(data, start, fields, 'sres');

  const nmtOffset = start + 2;
  const stateLabel = pushNmtStateField(
    data,
    nmtOffset,
    isFromManagingNode,
    fields,
    warnings,
    `sres-nmt-status-${nmtOffset}`,
    'StatusResponse — NMTStatus',
  );

  pushRawBlock(fields, data, {
    id: `sres-reserved-${start + 3}`,
    name: 'StatusResponse — Reserved',
    offset: start + 3,
    length: 3,
  });

  // İç kırılım yalnız W'de var → sekiz bayt TEK PARÇA (dosya başı).
  const staticErrorOffset = start + 6;
  pushRawBlock(fields, data, {
    id: `sres-static-error-${staticErrorOffset}`,
    name: 'StatusResponse — StaticErrorBitField',
    offset: staticErrorOffset,
    length: 8,
    warnings: [WARN_STATIC_ERROR_FIELD_NOT_SPLIT],
  });
  warnings.push(WARN_STATIC_ERROR_FIELD_NOT_SPLIT);

  const listStart = start + 14;
  const available = Math.max(0, end - listStart);
  const entryCount = Math.floor(available / ERROR_ENTRY_LENGTH);
  for (let index = 0; index < entryCount; index += 1) {
    decodeErrorHistoryEntry(data, listStart + index * ERROR_ENTRY_LENGTH, index, fields);
  }

  const trailing = available - entryCount * ERROR_ENTRY_LENGTH;
  if (trailing > 0) {
    // Kalan baytlar tam bir girdi etmiyor: ya Ethernet dolgusu ya da kesik
    // liste. Sessizce yutulmaz.
    pushRawBlock(fields, data, {
      id: `sres-error-list-trailing-${listStart + entryCount * ERROR_ENTRY_LENGTH}`,
      name: 'StatusResponse — ErrorCodeList trailing bytes',
      offset: listStart + entryCount * ERROR_ENTRY_LENGTH,
      length: trailing,
      warnings: [WARN_ERROR_HISTORY_TRAILING_BYTES],
    });
    warnings.push(WARN_ERROR_HISTORY_TRAILING_BYTES);
  }

  return `${stateLabel}, ${entryCount} error entr${entryCount === 1 ? 'y' : 'ies'}`;
}

function decodeErrorHistoryEntry(
  data: Uint8Array,
  offset: number,
  index: number,
  fields: ParsedField[],
): void {
  const entryType = readUint16Le(data, offset);
  fields.push({
    id: `sres-error-${index}-entry-type-${offset}`,
    name: `ErrorCodeList[${index}] — EntryType`,
    offset,
    length: 2,
    rawBytes: data.slice(offset, offset + 2),
    rawValue: entryType,
    physicalValue: formatHex(entryType, 4),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: `sres-error-${index}-entry-profile-${offset}`,
    name: `ErrorCodeList[${index}] — Profile (bits 0-11)`,
    offset,
    length: 2,
    rawBytes: data.slice(offset, offset + 2),
    rawValue: entryType & ENTRY_TYPE_PROFILE_MASK,
    valid: true,
    warnings: [],
  });
  const mode = (entryType & ENTRY_TYPE_MODE_MASK) >>> ENTRY_TYPE_MODE_SHIFT;
  fields.push({
    id: `sres-error-${index}-entry-mode-${offset}`,
    name: `ErrorCodeList[${index}] — Mode (bits 12-13)`,
    offset,
    length: 2,
    rawBytes: data.slice(offset, offset + 2),
    rawValue: mode,
    physicalValue: ENTRY_MODE_LABELS[mode] ?? '',
    valid: true,
    warnings: [],
  });
  fields.push({
    id: `sres-error-${index}-entry-emcy-${offset}`,
    name: `ErrorCodeList[${index}] — Emergency (bit 14)`,
    offset,
    length: 2,
    rawBytes: data.slice(offset, offset + 2),
    rawValue: (entryType & ENTRY_TYPE_EMCY_MASK) === 0 ? 0 : 1,
    physicalValue: (entryType & ENTRY_TYPE_EMCY_MASK) === 0 ? 'Not set' : 'Set',
    valid: true,
    warnings: [],
  });
  fields.push({
    id: `sres-error-${index}-entry-status-${offset}`,
    name: `ErrorCodeList[${index}] — Status entry (bit 15)`,
    offset,
    length: 2,
    rawBytes: data.slice(offset, offset + 2),
    rawValue: (entryType & ENTRY_TYPE_STATUS_MASK) === 0 ? 0 : 1,
    physicalValue: (entryType & ENTRY_TYPE_STATUS_MASK) === 0 ? 'History entry' : 'Status entry',
    valid: true,
    warnings: [],
  });

  const codeOffset = offset + 2;
  const code = readUint16Le(data, codeOffset);
  pushNumericField(fields, data, {
    id: `sres-error-${index}-code-${codeOffset}`,
    name: `ErrorCodeList[${index}] — ErrorCode`,
    offset: codeOffset,
    length: 2,
    physicalValue: formatHex(code, 4),
  });

  // tNetTime = seconds(U32 LE) + nanoseconds(U32 LE); W bunu
  // ENC_TIME_SECS_NSECS|ENC_LITTLE_ENDIAN ile aynı şekilde okuyor.
  pushNumericField(fields, data, {
    id: `sres-error-${index}-timestamp-seconds-${offset + 4}`,
    name: `ErrorCodeList[${index}] — TimeStamp seconds`,
    offset: offset + 4,
    length: 4,
    unit: 's',
  });
  pushNumericField(fields, data, {
    id: `sres-error-${index}-timestamp-nanoseconds-${offset + 8}`,
    name: `ErrorCodeList[${index}] — TimeStamp nanoseconds`,
    offset: offset + 8,
    length: 4,
    unit: 'ns',
  });
  pushRawBlock(fields, data, {
    id: `sres-error-${index}-additional-info-${offset + 12}`,
    name: `ErrorCodeList[${index}] — AdditionalInformation`,
    offset: offset + 12,
    length: 8,
  });
}

function decodeNmtRequest(
  data: Uint8Array,
  start: number,
  end: number,
  fields: ParsedField[],
  warnings: string[],
): string {
  const label = pushNmtCommandIdField(
    data,
    start,
    fields,
    warnings,
    `nmtreq-command-id-${start}`,
    'NMTRequest — RequestedCommandID',
  );

  const targetOffset = start + 1;
  const target = byteAt(data, targetOffset);
  pushNumericField(fields, data, {
    id: `nmtreq-command-target-${targetOffset}`,
    name: 'NMTRequest — RequestedCommandTarget',
    offset: targetOffset,
    length: 1,
    physicalValue: describeNodeId(target),
  });

  pushNmtCommandData(data, start + 2, end, fields, warnings, 'nmtreq');
  return label;
}

function decodeNmtCommand(
  data: Uint8Array,
  start: number,
  end: number,
  fields: ParsedField[],
  warnings: string[],
): string {
  const label = pushNmtCommandIdField(
    data,
    start,
    fields,
    warnings,
    `nmtcmd-command-id-${start}`,
    'NMTCommand — NMTCommandID',
  );

  pushRawBlock(fields, data, {
    id: `nmtcmd-reserved-${start + 1}`,
    name: 'NMTCommand — Reserved',
    offset: start + 1,
    length: 1,
  });

  pushNmtCommandData(data, start + 2, end, fields, warnings, 'nmtcmd');
  return label;
}

function pushNmtCommandIdField(
  data: Uint8Array,
  offset: number,
  fields: ParsedField[],
  warnings: string[],
  id: string,
  name: string,
): string {
  const commandId = byteAt(data, offset);
  const label = NMT_COMMAND_LABELS.get(commandId);
  const field: ParsedField = {
    id,
    name,
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: commandId,
    physicalValue: label ?? formatHex(commandId, 2),
    valid: label !== undefined,
    warnings: [],
  };
  if (label === undefined) {
    field.warnings.push(WARN_NMT_COMMAND_NOT_NAMED);
    warnings.push(WARN_NMT_COMMAND_NOT_NAMED);
  }
  fields.push(field);
  return label ?? formatHex(commandId, 2);
}

/**
 * NMT komut verisinin YAPISI komuta göre değişir (NMTPublish*'in node listesi,
 * NMTNetHostNameSet'in 32 baytlık adı, NMTResetNode'un hata gerekçesi …).
 * W bunların yalnız üçünü açıyor, O hiçbirini — iki kaynağın kesiştiği bir
 * kırılım YOK. Bölge tek parça ham basılır ve nedeni söylenir.
 */
function pushNmtCommandData(
  data: Uint8Array,
  start: number,
  end: number,
  fields: ParsedField[],
  warnings: string[],
  prefix: string,
): void {
  const length = end - start;
  if (length <= 0) return;
  pushRawBlock(fields, data, {
    id: `${prefix}-command-data-${start}`,
    name: 'NMT — CommandData',
    offset: start,
    length,
    warnings: [WARN_NMT_COMMAND_DATA_NOT_DECODED],
  });
  warnings.push(WARN_NMT_COMMAND_DATA_NOT_DECODED);
}

function decodeSyncResponse(
  data: Uint8Array,
  start: number,
  end: number,
  fields: ParsedField[],
): void {
  pushRawBlock(fields, data, {
    id: `syncres-reserved-${start}`,
    name: 'SyncResponse — Reserved',
    offset: start,
    length: 2,
  });

  const statusOffset = start + 2;
  const status = readUint32Le(data, statusOffset);
  pushNumericField(fields, data, {
    id: `syncres-sync-status-${statusOffset}`,
    name: 'SyncResponse — SyncStatus',
    offset: statusOffset,
    length: 4,
    physicalValue: formatHex(status, 8),
  });

  const numeric: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly delta: number;
    readonly unit?: string;
  }> = [
    { id: 'latency', name: 'Latency', delta: 6, unit: 'ns' },
    { id: 'sync-node-number', name: 'SyncNodeNumber', delta: 10 },
    { id: 'sync-delay', name: 'SyncDelay', delta: 14, unit: 'ns' },
    { id: 'pres-time-first', name: 'PResTimeFirst', delta: 18, unit: 'ns' },
    { id: 'pres-time-second', name: 'PResTimeSecond', delta: 22, unit: 'ns' },
  ];
  for (const entry of numeric) {
    const offset = start + entry.delta;
    if (offset + 4 > end) break;
    pushNumericField(fields, data, {
      id: `syncres-${entry.id}-${offset}`,
      name: `SyncResponse — ${entry.name}`,
      offset,
      length: 4,
      ...(entry.unit === undefined ? {} : { unit: entry.unit }),
    });
  }
}
