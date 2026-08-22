/**
 * SNMP (RFC 1157 v1 · RFC 3416 v2c · RFC 3412 v3) — BER kodlu ağ yönetimi.
 * Girdi TEK bir SNMP mesajıdır (UDP/161-162 sarmalayıcısı YOK, `ntp.ts`
 * kararının aynısı).
 *
 * ── `berReader.ts` HAZIR BULUNDU, YENİDEN YAZILMADI ─────────────────────────
 * TLV yürüyücüsü, uzunluk okuma ve INTEGER/OCTET STRING çözümü GOOSE için
 * (`protocol-core/decoding/berReader.ts`) zaten yazılmıştı ve dalga 12 boyunca
 * kullanılmayı bekliyordu. Bu dalgada ona iki kardeş eklendi —
 * `decodeBerObjectIdentifier` ve `decodeBerUnsignedInteger` — ikisi de X.690'ın
 * kendi tanımları olduğu için AYNI dosyaya kondu, SNMP'ye özel yeni bir modül
 * açılmadı. (12b/12c/12d'nin "paylaşılan modülü speküle etme" dersinin tersi
 * yönü: burada paylaşım GERÇEK, çünkü kodlama standardı ortak.)
 *
 * ── v1 Trap-PDU'NUN GÖVDESİ TAMAMEN FARKLIDIR ───────────────────────────────
 * Bütün PDU'lar `request-id · error-status · error-index · varbinds` taşır —
 * **Trap-PDU (`0xA4`) HARİÇ**. O `enterprise OID · agent-addr · generic-trap ·
 * specific-trap · time-stamp · varbinds` taşır ve YALNIZ v1'de vardır. Ortak
 * gövdeyle okumak OID'i "request-id" diye gösterir, hiçbir yerde patlamaz.
 * v2c'nin trap'i (`0xA7`) ise standart gövdeyi kullanır — aynı adı taşıyan iki
 * mesaj, iki ayrı yapı.
 *
 * ── GetBulk'un İKİNCİ VE ÜÇÜNCÜ ALANI HATA ALANI DEĞİLDİR ───────────────────
 * `0xA5`te aynı konumlardaki iki INTEGER `non-repeaters` ve `max-repetitions`
 * tir (RFC 3416 §4.2.3). Tip de konum da aynı olduğu için "error-status: 10"
 * diye basmak yapısal olarak geçerli, anlamca tamamen yanlış bir çıktı verir.
 *
 * ── SÜRÜM ALANI SIFIR TABANLI VE 2 YOKTUR ───────────────────────────────────
 * 0 → v1, 1 → v2c, 3 → v3 (`snmpTypes.ts`). Ham sayıyı basmak v2c'yi
 * "SNMPv1" gösterir.
 *
 * ── UYGULAMA TİPLERİ İŞARETSİZ ──────────────────────────────────────────────
 * Counter32/Gauge32/TimeTicks/Counter64 işaretsizdir; TimeTicks ayrıca saniye
 * değil saniyenin YÜZDE BİRİdir. İkisi de `snmpTypes.ts`te gerekçeli.
 *
 * ── v3: ZARF ÇÖZÜLÜR, ŞİFRELİ GÖVDE ÇÖZÜLMEZ ────────────────────────────────
 * Brief'in açık sorusu 2 "v3 uyarıyla dışarıda" öneriyordu; kapsam bundan biraz
 * GENİŞ tutuldu çünkü spec (`:376-377`) açıkça "Security Model, Security Level,
 * Engine ID, User" istiyor ve bunların hiçbiri ANAHTAR GEREKTİRMEZ: msgGlobalData
 * ile USM güvenlik parametreleri düz BER'dir. Anahtar isteyen tek şey şifreli
 * ScopedPDU'dur, o da spec'in dediği gibi "Encrypted / Unable to decode payload"
 * olarak bırakılır. Kimlik doğrulama/şifre çözme YAPILMAZ — `ntp.ts`in MD5
 * özetini doğrulamama kararının aynı cinsi.
 *
 * ── MIB İMPORTU BU DALGANIN İŞİ DEĞİL ───────────────────────────────────────
 * Katalog `definitions: ['custom-schema']` işaretli ama kanal boş. `snmpTypes.ts`
 * yalnız spec örneklerinde geçen system/interface grubunu adlandırır; kalan OID
 * ham kalır (12b'nin `vendor-map` kararının aynısı).
 */

import {
  decodeBerInteger,
  decodeBerObjectIdentifier,
  decodeBerUnsignedInteger,
  readBerTlv,
} from '@/protocol-core/decoding/berReader';
import type { BerFailure, BerTlv } from '@/protocol-core/decoding/berReader';
import {
  ERROR_STATUS_NAMES,
  GENERIC_TRAP_NAMES,
  MSG_FLAG_AUTH,
  MSG_FLAG_PRIV,
  MSG_FLAG_REPORTABLE,
  PDU_GET_BULK_REQUEST,
  PDU_GET_REQUEST,
  PDU_RESPONSE,
  PDU_TRAP_V1,
  PDU_TYPE_NAMES,
  SECURITY_MODEL_NAMES,
  TAG_COUNTER32,
  TAG_COUNTER64,
  TAG_END_OF_MIB_VIEW,
  TAG_GAUGE32,
  TAG_INTEGER,
  TAG_IP_ADDRESS,
  TAG_NO_SUCH_INSTANCE,
  TAG_NO_SUCH_OBJECT,
  TAG_NULL,
  TAG_OBJECT_IDENTIFIER,
  TAG_OCTET_STRING,
  TAG_OPAQUE,
  TAG_SEQUENCE,
  TAG_TIME_TICKS,
  VERSION_NAMES,
  VERSION_V1,
  VERSION_V2C,
  VERSION_V3,
  formatTimeTicks,
  resolveOidName,
} from './snmpTypes';
import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolErrorCode,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'snmp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'SNMP';

/** SEQUENCE etiketi + en kısa uzunluk baytı + en kısa INTEGER sürüm alanı. */
const MIN_FRAME_LENGTH = 5;

const IPV4_ADDRESS_LENGTH = 4;
const HEX_RADIX = 16;
const ASCII_PRINTABLE_MIN = 0x20;
const ASCII_PRINTABLE_MAX = 0x7e;
/** Bozuk uzunluk alanı sonsuz VarBind üretmesin (spec §41). */
const MAX_VARBINDS = 128;

const ERROR_FRAME_TOO_SHORT = 'protocol.snmp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.snmp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.snmp.error.aborted';
const ERROR_NOT_A_SEQUENCE = 'protocol.snmp.error.notASequence';
const ERROR_BER = 'protocol.snmp.error.ber';

const WARN_UNKNOWN_VERSION = 'protocol.snmp.warning.unknownVersion';
const WARN_UNKNOWN_PDU_TYPE = 'protocol.snmp.warning.unknownPduType';
const WARN_TRAP_V1_ONLY = 'protocol.snmp.warning.trapV1Only';
const WARN_UNKNOWN_ERROR_STATUS = 'protocol.snmp.warning.unknownErrorStatus';
const WARN_UNKNOWN_GENERIC_TRAP = 'protocol.snmp.warning.unknownGenericTrap';
const WARN_COMMUNITY_IN_CLEAR = 'protocol.snmp.warning.communityInClear';
const WARN_UNKNOWN_VALUE_TAG = 'protocol.snmp.warning.unknownValueTag';
const WARN_OID_NOT_IN_TABLE = 'protocol.snmp.warning.oidNotInTable';
const WARN_VARBIND_EXCEPTION = 'protocol.snmp.warning.varbindException';
const WARN_ENCRYPTED_SCOPED_PDU = 'protocol.snmp.warning.encryptedScopedPdu';
const WARN_UNKNOWN_SECURITY_MODEL = 'protocol.snmp.warning.unknownSecurityModel';
const WARN_VARBIND_LIMIT = 'protocol.snmp.warning.varbindLimit';
const WARN_IP_ADDRESS_LENGTH = 'protocol.snmp.warning.ipAddressLength';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(2, '0')).join('');
}

function formatIpv4Address(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String(byte)).join('.');
}

/** OCTET STRING metin mi ham mı: basılabilir ASCII değilse onaltılık gösterilir. */
function readOctetString(bytes: Uint8Array, offset: number, length: number): string {
  let printable = true;
  let text = '';
  for (let index = 0; index < length; index += 1) {
    const octet = byteAt(bytes, offset + index);
    if (octet < ASCII_PRINTABLE_MIN || octet > ASCII_PRINTABLE_MAX) printable = false;
    text += String.fromCharCode(octet);
  }
  return printable ? text : `0x${formatHex(bytes.slice(offset, offset + length))}`;
}

/**
 * BER katmanının hatasını protokol katmanının koduna çevirir. İkisi KASTEN ayrı
 * union'dır (`berReader.ts` dosya başı) — burası tek eşleme noktası.
 */
const BER_ERROR_MAP: Readonly<Record<BerFailure['error'], ProtocolErrorCode>> = {
  truncated: 'truncated-frame',
  'long-form-tag': 'unsupported-encoding',
  'indefinite-length': 'unsupported-encoding',
  'reserved-length-octet': 'unsupported-encoding',
  'length-octets-unsupported': 'unsupported-encoding',
  'value-overflow': 'length-mismatch',
  'unexpected-value-length': 'length-mismatch',
};

function toProtocolError(failure: BerFailure): ProtocolError {
  return {
    code: BER_ERROR_MAP[failure.error],
    message: ERROR_BER,
    offset: failure.offset,
    details: { berError: failure.error },
  };
}

interface SnmpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

/** Çözüm sırasında biriken çıktı — her yardımcı buna yazar. */
interface Sink {
  readonly fields: ParsedField[];
  readonly warnings: ProtocolWarning[];
  readonly errors: ProtocolError[];
}

function pushWarning(sink: Sink, key: string): void {
  sink.warnings.push(toProtocolWarning(key));
}

/** TLV okur; başarısızlıkta hatayı `sink`e yazıp `undefined` döner. */
function nextTlv(data: Uint8Array, offset: number, limit: number, sink: Sink): BerTlv | undefined {
  const read = readBerTlv(data, offset, limit);
  if (!read.ok) {
    sink.errors.push(toProtocolError(read));
    return undefined;
  }
  return read;
}

/** INTEGER TLV'sini okuyup alan basar; değeri döner. */
function pushIntegerField(
  data: Uint8Array,
  tlv: BerTlv,
  id: string,
  name: string,
  sink: Sink,
  physical?: (value: bigint) => string | undefined,
): bigint | undefined {
  const decoded = decodeBerInteger(data, tlv.valueOffset, tlv.length);
  if (!decoded.ok) {
    sink.errors.push(toProtocolError(decoded));
    return undefined;
  }

  const field: ParsedField = {
    id,
    name,
    offset: tlv.offset,
    length: tlv.end - tlv.offset,
    rawBytes: data.slice(tlv.offset, tlv.end),
    rawValue: decoded.value,
    valid: true,
    warnings: [],
  };
  const text = physical?.(decoded.value);
  if (text !== undefined) field.physicalValue = text;
  sink.fields.push(field);
  return decoded.value;
}

function pushOctetStringField(
  data: Uint8Array,
  tlv: BerTlv,
  id: string,
  name: string,
  sink: Sink,
): string {
  const text = readOctetString(data, tlv.valueOffset, tlv.length);
  sink.fields.push({
    id,
    name,
    offset: tlv.offset,
    length: tlv.end - tlv.offset,
    rawBytes: data.slice(tlv.offset, tlv.end),
    rawValue: text,
    valid: true,
    warnings: [],
  });
  return text;
}

/** VarBind değerini tipine göre çözer; tanınmayan etiket ham bırakılır. */
function pushVarbindValue(data: Uint8Array, tlv: BerTlv, index: number, sink: Sink): void {
  const id = `varbind-${index}-value`;
  const name = `VarBind ${index} Value`;
  const tagByte = tlv.tag.byte;

  const base: ParsedField = {
    id,
    name,
    offset: tlv.offset,
    length: tlv.end - tlv.offset,
    rawBytes: data.slice(tlv.offset, tlv.end),
    valid: true,
    warnings: [],
  };

  const typeField: ParsedField = {
    id: `varbind-${index}-type`,
    name: `VarBind ${index} Type`,
    offset: tlv.offset,
    length: 1,
    rawBytes: data.slice(tlv.offset, tlv.offset + 1),
    rawValue: tagByte,
    valid: true,
    warnings: [],
  };

  switch (tagByte) {
    case TAG_INTEGER: {
      typeField.physicalValue = 'INTEGER';
      const decoded = decodeBerInteger(data, tlv.valueOffset, tlv.length);
      if (decoded.ok) base.rawValue = decoded.value;
      else sink.errors.push(toProtocolError(decoded));
      break;
    }
    case TAG_OCTET_STRING:
      typeField.physicalValue = 'OCTET STRING';
      base.rawValue = readOctetString(data, tlv.valueOffset, tlv.length);
      break;
    case TAG_NULL:
      typeField.physicalValue = 'NULL';
      base.physicalValue = 'NULL';
      break;
    case TAG_OBJECT_IDENTIFIER: {
      typeField.physicalValue = 'OBJECT IDENTIFIER';
      const decoded = decodeBerObjectIdentifier(data, tlv.valueOffset, tlv.length);
      if (decoded.ok) {
        base.rawValue = decoded.text;
        const named = resolveOidName(decoded.text);
        if (named !== undefined) base.physicalValue = named;
      } else sink.errors.push(toProtocolError(decoded));
      break;
    }
    case TAG_IP_ADDRESS: {
      typeField.physicalValue = 'IpAddress';
      const raw = data.slice(tlv.valueOffset, tlv.valueOffset + tlv.length);
      if (tlv.length === IPV4_ADDRESS_LENGTH) {
        base.rawValue = formatIpv4Address(raw);
      } else {
        // IpAddress ZORUNLU olarak 4 bayttır (RFC 2578); değilse adres uydurulmaz.
        base.rawValue = `0x${formatHex(raw)}`;
        base.valid = false;
        base.warnings = [WARN_IP_ADDRESS_LENGTH];
        pushWarning(sink, WARN_IP_ADDRESS_LENGTH);
      }
      break;
    }
    case TAG_COUNTER32:
    case TAG_GAUGE32:
    case TAG_COUNTER64: {
      typeField.physicalValue =
        tagByte === TAG_COUNTER32 ? 'Counter32' : tagByte === TAG_GAUGE32 ? 'Gauge32' : 'Counter64';
      // İŞARETSİZ okunur (snmpTypes.ts dosya başı).
      const decoded = decodeBerUnsignedInteger(data, tlv.valueOffset, tlv.length);
      if (decoded.ok) base.rawValue = decoded.value;
      else sink.errors.push(toProtocolError(decoded));
      break;
    }
    case TAG_TIME_TICKS: {
      typeField.physicalValue = 'TimeTicks';
      const decoded = decodeBerUnsignedInteger(data, tlv.valueOffset, tlv.length);
      if (decoded.ok) {
        base.rawValue = decoded.value;
        // Saniyenin YÜZDE BİRİ — ham sayı saniye sanılmasın. `unit` VERİLMEZ:
        // panel birimi fiziksel değere yapıştırıyor ve "0d 01:00:00.00 cs"
        // biçimlenmiş süreyi centisaniye gibi gösterirdi.
        base.physicalValue = formatTimeTicks(decoded.value);
      } else sink.errors.push(toProtocolError(decoded));
      break;
    }
    case TAG_OPAQUE:
      typeField.physicalValue = 'Opaque';
      // Opaque'in içi başka bir ASN.1 kodlamasıdır; açmak uydurma olur.
      base.rawValue = `0x${formatHex(data.slice(tlv.valueOffset, tlv.valueOffset + tlv.length))}`;
      break;
    case TAG_NO_SUCH_OBJECT:
    case TAG_NO_SUCH_INSTANCE:
    case TAG_END_OF_MIB_VIEW:
      // Uzunlukları SIFIR; taşıdıkları bilgi etiketin KENDİSİ (snmpTypes.ts).
      typeField.physicalValue =
        tagByte === TAG_NO_SUCH_OBJECT
          ? 'noSuchObject'
          : tagByte === TAG_NO_SUCH_INSTANCE
            ? 'noSuchInstance'
            : 'endOfMibView';
      base.physicalValue = typeField.physicalValue;
      base.warnings = [WARN_VARBIND_EXCEPTION];
      pushWarning(sink, WARN_VARBIND_EXCEPTION);
      break;
    default:
      base.rawValue = `0x${formatHex(data.slice(tlv.valueOffset, tlv.valueOffset + tlv.length))}`;
      base.valid = false;
      base.warnings = [WARN_UNKNOWN_VALUE_TAG];
      typeField.valid = false;
      pushWarning(sink, WARN_UNKNOWN_VALUE_TAG);
      break;
  }

  sink.fields.push(typeField, base);
}

/** `variable-bindings SEQUENCE OF SEQUENCE { name OID, value ANY }`. */
function parseVarbinds(data: Uint8Array, listTlv: BerTlv, sink: Sink): void {
  let cursor = listTlv.valueOffset;
  let index = 0;
  let missingName = false;

  while (cursor < listTlv.end) {
    if (index >= MAX_VARBINDS) {
      pushWarning(sink, WARN_VARBIND_LIMIT);
      return;
    }

    const pair = nextTlv(data, cursor, listTlv.end, sink);
    if (pair === undefined) return;

    const oidTlv = nextTlv(data, pair.valueOffset, pair.end, sink);
    if (oidTlv === undefined) return;

    const decoded = decodeBerObjectIdentifier(data, oidTlv.valueOffset, oidTlv.length);
    if (!decoded.ok) {
      sink.errors.push(toProtocolError(decoded));
      return;
    }

    const oidField: ParsedField = {
      id: `varbind-${index}-oid`,
      name: `VarBind ${index} OID`,
      offset: oidTlv.offset,
      length: oidTlv.end - oidTlv.offset,
      rawBytes: data.slice(oidTlv.offset, oidTlv.end),
      rawValue: decoded.text,
      valid: true,
      warnings: [],
    };
    const named = resolveOidName(decoded.text);
    if (named !== undefined) oidField.physicalValue = named;
    else missingName = true;
    sink.fields.push(oidField);

    const valueTlv = nextTlv(data, oidTlv.end, pair.end, sink);
    if (valueTlv === undefined) return;
    pushVarbindValue(data, valueTlv, index, sink);

    cursor = pair.end;
    index += 1;
  }

  // MIB kanalı boş olduğu için tablonun dışı adlandırılamıyor — bir kez uyar.
  if (missingName) pushWarning(sink, WARN_OID_NOT_IN_TABLE);
}

/** Standart PDU gövdesi: request-id · error-status · error-index · varbinds. */
function parseStandardPdu(data: Uint8Array, pduTlv: BerTlv, isGetBulk: boolean, sink: Sink): void {
  const requestIdTlv = nextTlv(data, pduTlv.valueOffset, pduTlv.end, sink);
  if (requestIdTlv === undefined) return;
  pushIntegerField(data, requestIdTlv, 'request-id', 'Request ID', sink);

  const secondTlv = nextTlv(data, requestIdTlv.end, pduTlv.end, sink);
  if (secondTlv === undefined) return;
  const thirdTlv = nextTlv(data, secondTlv.end, pduTlv.end, sink);
  if (thirdTlv === undefined) return;

  if (isGetBulk) {
    // AYNI konum, AYNI tip, BAŞKA anlam (dosya başı).
    pushIntegerField(data, secondTlv, 'non-repeaters', 'Non-Repeaters', sink);
    pushIntegerField(data, thirdTlv, 'max-repetitions', 'Max-Repetitions', sink);
  } else {
    let unknownStatus = false;
    pushIntegerField(data, secondTlv, 'error-status', 'Error Status', sink, (value) => {
      const name = ERROR_STATUS_NAMES.get(Number(value));
      if (name === undefined) unknownStatus = true;
      return name;
    });
    if (unknownStatus) pushWarning(sink, WARN_UNKNOWN_ERROR_STATUS);
    pushIntegerField(data, thirdTlv, 'error-index', 'Error Index', sink);
  }

  const varbindsTlv = nextTlv(data, thirdTlv.end, pduTlv.end, sink);
  if (varbindsTlv === undefined) return;
  parseVarbinds(data, varbindsTlv, sink);
}

/** v1 Trap-PDU gövdesi — standart PDU'yla HİÇBİR alanı ortak değil (dosya başı). */
function parseTrapV1Pdu(data: Uint8Array, pduTlv: BerTlv, sink: Sink): void {
  const enterpriseTlv = nextTlv(data, pduTlv.valueOffset, pduTlv.end, sink);
  if (enterpriseTlv === undefined) return;
  const enterprise = decodeBerObjectIdentifier(data, enterpriseTlv.valueOffset, enterpriseTlv.length);
  if (!enterprise.ok) {
    sink.errors.push(toProtocolError(enterprise));
    return;
  }
  sink.fields.push({
    id: 'enterprise',
    name: 'Enterprise OID',
    offset: enterpriseTlv.offset,
    length: enterpriseTlv.end - enterpriseTlv.offset,
    rawBytes: data.slice(enterpriseTlv.offset, enterpriseTlv.end),
    rawValue: enterprise.text,
    valid: true,
    warnings: [],
  });

  const agentTlv = nextTlv(data, enterpriseTlv.end, pduTlv.end, sink);
  if (agentTlv === undefined) return;
  const agentRaw = data.slice(agentTlv.valueOffset, agentTlv.valueOffset + agentTlv.length);
  const agentField: ParsedField = {
    id: 'agent-address',
    name: 'Agent Address',
    offset: agentTlv.offset,
    length: agentTlv.end - agentTlv.offset,
    rawBytes: data.slice(agentTlv.offset, agentTlv.end),
    valid: true,
    warnings: [],
  };
  if (agentTlv.length === IPV4_ADDRESS_LENGTH) {
    agentField.rawValue = formatIpv4Address(agentRaw);
  } else {
    agentField.rawValue = `0x${formatHex(agentRaw)}`;
    agentField.valid = false;
    agentField.warnings = [WARN_IP_ADDRESS_LENGTH];
    pushWarning(sink, WARN_IP_ADDRESS_LENGTH);
  }
  sink.fields.push(agentField);

  const genericTlv = nextTlv(data, agentTlv.end, pduTlv.end, sink);
  if (genericTlv === undefined) return;
  let unknownGeneric = false;
  pushIntegerField(data, genericTlv, 'generic-trap', 'Generic Trap', sink, (value) => {
    const name = GENERIC_TRAP_NAMES.get(Number(value));
    if (name === undefined) unknownGeneric = true;
    return name;
  });
  if (unknownGeneric) pushWarning(sink, WARN_UNKNOWN_GENERIC_TRAP);

  const specificTlv = nextTlv(data, genericTlv.end, pduTlv.end, sink);
  if (specificTlv === undefined) return;
  pushIntegerField(data, specificTlv, 'specific-trap', 'Specific Trap', sink);

  const timestampTlv = nextTlv(data, specificTlv.end, pduTlv.end, sink);
  if (timestampTlv === undefined) return;
  const ticks = decodeBerUnsignedInteger(data, timestampTlv.valueOffset, timestampTlv.length);
  if (!ticks.ok) {
    sink.errors.push(toProtocolError(ticks));
    return;
  }
  sink.fields.push({
    id: 'trap-time-stamp',
    name: 'Time Stamp',
    offset: timestampTlv.offset,
    length: timestampTlv.end - timestampTlv.offset,
    rawBytes: data.slice(timestampTlv.offset, timestampTlv.end),
    rawValue: ticks.value,
    physicalValue: formatTimeTicks(ticks.value),
    valid: true,
    warnings: [],
  });

  const varbindsTlv = nextTlv(data, timestampTlv.end, pduTlv.end, sink);
  if (varbindsTlv === undefined) return;
  parseVarbinds(data, varbindsTlv, sink);
}

/** USM güvenlik parametreleri — OCTET STRING'in İÇİ ayrı bir BER SEQUENCE'tır. */
function parseUsmParameters(data: Uint8Array, wrapper: BerTlv, sink: Sink): void {
  const inner = nextTlv(data, wrapper.valueOffset, wrapper.end, sink);
  if (inner === undefined || inner.tag.byte !== TAG_SEQUENCE) return;

  const engineIdTlv = nextTlv(data, inner.valueOffset, inner.end, sink);
  if (engineIdTlv === undefined) return;
  sink.fields.push({
    id: 'usm-engine-id',
    name: 'Authoritative Engine ID',
    offset: engineIdTlv.offset,
    length: engineIdTlv.end - engineIdTlv.offset,
    rawBytes: data.slice(engineIdTlv.offset, engineIdTlv.end),
    rawValue: `0x${formatHex(data.slice(engineIdTlv.valueOffset, engineIdTlv.valueOffset + engineIdTlv.length))}`,
    valid: true,
    warnings: [],
  });

  const bootsTlv = nextTlv(data, engineIdTlv.end, inner.end, sink);
  if (bootsTlv === undefined) return;
  pushIntegerField(data, bootsTlv, 'usm-engine-boots', 'Authoritative Engine Boots', sink);

  const timeTlv = nextTlv(data, bootsTlv.end, inner.end, sink);
  if (timeTlv === undefined) return;
  // USM'in `EngineTime`ı SANİYEDİR — TimeTicks değil (RFC 3414 §2.2.2).
  pushIntegerField(data, timeTlv, 'usm-engine-time', 'Authoritative Engine Time', sink);

  const userTlv = nextTlv(data, timeTlv.end, inner.end, sink);
  if (userTlv === undefined) return;
  pushOctetStringField(data, userTlv, 'usm-user-name', 'User Name', sink);

  const authTlv = nextTlv(data, userTlv.end, inner.end, sink);
  if (authTlv === undefined) return;
  sink.fields.push({
    id: 'usm-authentication-parameters',
    name: 'Authentication Parameters',
    offset: authTlv.offset,
    length: authTlv.end - authTlv.offset,
    rawBytes: data.slice(authTlv.offset, authTlv.end),
    // Doğrulanmaz: paylaşılan anahtar bu araçta yok (dosya başı).
    rawValue: `0x${formatHex(data.slice(authTlv.valueOffset, authTlv.valueOffset + authTlv.length))}`,
    valid: true,
    warnings: [],
  });

  const privTlv = nextTlv(data, authTlv.end, inner.end, sink);
  if (privTlv === undefined) return;
  sink.fields.push({
    id: 'usm-privacy-parameters',
    name: 'Privacy Parameters',
    offset: privTlv.offset,
    length: privTlv.end - privTlv.offset,
    rawBytes: data.slice(privTlv.offset, privTlv.end),
    rawValue: `0x${formatHex(data.slice(privTlv.valueOffset, privTlv.valueOffset + privTlv.length))}`,
    valid: true,
    warnings: [],
  });
}

/** PDU'yu etiketine göre doğru gövdeye yollar. */
function parsePdu(data: Uint8Array, pduTlv: BerTlv, sink: Sink, version: number): void {
  const pduName = PDU_TYPE_NAMES.get(pduTlv.tag.byte);
  const pduField: ParsedField = {
    id: 'pdu-type',
    name: 'PDU Type',
    offset: pduTlv.offset,
    length: 1,
    rawBytes: data.slice(pduTlv.offset, pduTlv.offset + 1),
    rawValue: pduTlv.tag.byte,
    valid: pduName !== undefined,
    warnings: [],
  };
  if (pduName !== undefined) pduField.physicalValue = pduName;
  else {
    pduField.warnings = [WARN_UNKNOWN_PDU_TYPE];
    pushWarning(sink, WARN_UNKNOWN_PDU_TYPE);
  }
  sink.fields.push(pduField);

  if (pduTlv.tag.byte === PDU_TRAP_V1) {
    if (version !== VERSION_V1) {
      // Trap-PDU v2c/v3 mesajında yapısal olarak okunur ama SPEC DIŞIDIR.
      pduField.valid = false;
      pushWarning(sink, WARN_TRAP_V1_ONLY);
    }
    parseTrapV1Pdu(data, pduTlv, sink);
    return;
  }

  if (pduName === undefined) return;
  parseStandardPdu(data, pduTlv, pduTlv.tag.byte === PDU_GET_BULK_REQUEST, sink);
}

/** v1/v2c gövdesi: community + PDU. */
function parseCommunityMessage(data: Uint8Array, outer: BerTlv, versionTlv: BerTlv, sink: Sink, version: number): void {
  const communityTlv = nextTlv(data, versionTlv.end, outer.end, sink);
  if (communityTlv === undefined) return;
  pushOctetStringField(data, communityTlv, 'community', 'Community', sink);
  // Community düz metindir ve v1/v2c'de tek kimlik denetimidir (RFC 1157 §3).
  pushWarning(sink, WARN_COMMUNITY_IN_CLEAR);

  const pduTlv = nextTlv(data, communityTlv.end, outer.end, sink);
  if (pduTlv === undefined) return;
  parsePdu(data, pduTlv, sink, version);
}

/** v3 zarfı: msgGlobalData + msgSecurityParameters + msgData. */
function parseV3Message(data: Uint8Array, outer: BerTlv, versionTlv: BerTlv, sink: Sink): void {
  const globalTlv = nextTlv(data, versionTlv.end, outer.end, sink);
  if (globalTlv === undefined) return;

  const msgIdTlv = nextTlv(data, globalTlv.valueOffset, globalTlv.end, sink);
  if (msgIdTlv === undefined) return;
  pushIntegerField(data, msgIdTlv, 'msg-id', 'Message ID', sink);

  const maxSizeTlv = nextTlv(data, msgIdTlv.end, globalTlv.end, sink);
  if (maxSizeTlv === undefined) return;
  pushIntegerField(data, maxSizeTlv, 'msg-max-size', 'Max Size', sink);

  const flagsTlv = nextTlv(data, maxSizeTlv.end, globalTlv.end, sink);
  if (flagsTlv === undefined) return;
  const flags = byteAt(data, flagsTlv.valueOffset);
  const authSet = (flags & MSG_FLAG_AUTH) !== 0;
  const privSet = (flags & MSG_FLAG_PRIV) !== 0;
  const flagNames: string[] = [];
  if (authSet) flagNames.push('authFlag');
  if (privSet) flagNames.push('privFlag');
  if ((flags & MSG_FLAG_REPORTABLE) !== 0) flagNames.push('reportableFlag');
  sink.fields.push({
    id: 'msg-flags',
    name: 'Message Flags',
    offset: flagsTlv.offset,
    length: flagsTlv.end - flagsTlv.offset,
    rawBytes: data.slice(flagsTlv.offset, flagsTlv.end),
    rawValue: flags,
    physicalValue: flagNames.length === 0 ? 'none' : flagNames.join(', '),
    valid: true,
    warnings: [],
  });

  // Spec `:376` "Security Level" istiyor; bu iki bitin ADI odur.
  sink.fields.push({
    id: 'security-level',
    name: 'Security Level',
    offset: flagsTlv.offset,
    length: flagsTlv.end - flagsTlv.offset,
    rawBytes: data.slice(flagsTlv.offset, flagsTlv.end),
    physicalValue: privSet ? 'authPriv' : authSet ? 'authNoPriv' : 'noAuthNoPriv',
    valid: true,
    warnings: [],
  });

  const modelTlv = nextTlv(data, flagsTlv.end, globalTlv.end, sink);
  if (modelTlv === undefined) return;
  let unknownModel = false;
  const model = pushIntegerField(data, modelTlv, 'msg-security-model', 'Security Model', sink, (value) => {
    const name = SECURITY_MODEL_NAMES.get(Number(value));
    if (name === undefined) unknownModel = true;
    return name;
  });
  if (unknownModel) pushWarning(sink, WARN_UNKNOWN_SECURITY_MODEL);

  const securityTlv = nextTlv(data, globalTlv.end, outer.end, sink);
  if (securityTlv === undefined) return;
  if (model === 3n) {
    parseUsmParameters(data, securityTlv, sink);
  } else {
    // USM dışı model: iç yapı bilinmiyor, ham bırakılır.
    sink.fields.push({
      id: 'msg-security-parameters',
      name: 'Security Parameters',
      offset: securityTlv.offset,
      length: securityTlv.end - securityTlv.offset,
      rawBytes: data.slice(securityTlv.offset, securityTlv.end),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }

  const dataTlv = nextTlv(data, securityTlv.end, outer.end, sink);
  if (dataTlv === undefined) return;

  if (privSet || dataTlv.tag.byte === TAG_OCTET_STRING) {
    // Şifreli ScopedPDU: spec `:377` "Encrypted / Unable to decode payload".
    sink.fields.push({
      id: 'encrypted-scoped-pdu',
      name: 'Encrypted ScopedPDU',
      offset: dataTlv.offset,
      length: dataTlv.end - dataTlv.offset,
      rawBytes: data.slice(dataTlv.offset, dataTlv.end),
      // `unit` yok: panel birimi değere yapıştırır, "Encrypted B" çıkardı.
      physicalValue: 'Encrypted',
      valid: true,
      warnings: [WARN_ENCRYPTED_SCOPED_PDU],
    });
    pushWarning(sink, WARN_ENCRYPTED_SCOPED_PDU);
    return;
  }

  const engineIdTlv = nextTlv(data, dataTlv.valueOffset, dataTlv.end, sink);
  if (engineIdTlv === undefined) return;
  sink.fields.push({
    id: 'context-engine-id',
    name: 'Context Engine ID',
    offset: engineIdTlv.offset,
    length: engineIdTlv.end - engineIdTlv.offset,
    rawBytes: data.slice(engineIdTlv.offset, engineIdTlv.end),
    rawValue: `0x${formatHex(data.slice(engineIdTlv.valueOffset, engineIdTlv.valueOffset + engineIdTlv.length))}`,
    valid: true,
    warnings: [],
  });

  const contextNameTlv = nextTlv(data, engineIdTlv.end, dataTlv.end, sink);
  if (contextNameTlv === undefined) return;
  pushOctetStringField(data, contextNameTlv, 'context-name', 'Context Name', sink);

  const pduTlv = nextTlv(data, contextNameTlv.end, dataTlv.end, sink);
  if (pduTlv === undefined) return;
  parsePdu(data, pduTlv, sink, VERSION_V3);
}

function parseSnmpFrame(data: Uint8Array, options: SnmpParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil (spec §41).
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
        details: { requiredBytes: MIN_FRAME_LENGTH, availableBytes: data.length },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = options.maxFrameLength;
  if (maxFrameLength !== undefined && data.length > maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: maxFrameLength,
        length: data.length - maxFrameLength,
        details: { maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const outerRead = readBerTlv(data, 0);
  if (!outerRead.ok) {
    const error = toProtocolError(outerRead);
    return { success: false, error, consumedBytes: 0, recoverable: true };
  }
  if (outerRead.tag.byte !== TAG_SEQUENCE) {
    // Her SNMP mesajı bir SEQUENCE'tır; değilse bu akış SNMP değildir.
    return {
      success: false,
      error: { code: 'start-delimiter-not-found', message: ERROR_NOT_A_SEQUENCE, offset: 0, length: 1 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const sink: Sink = { fields: [], warnings: [], errors: [] };

  const versionTlv = nextTlv(data, outerRead.valueOffset, outerRead.end, sink);
  if (versionTlv !== undefined) {
    let unknownVersion = false;
    const version = pushIntegerField(data, versionTlv, 'version', 'Version', sink, (value) => {
      const name = VERSION_NAMES.get(Number(value));
      if (name === undefined) unknownVersion = true;
      return name;
    });
    if (unknownVersion) pushWarning(sink, WARN_UNKNOWN_VERSION);

    if (version === BigInt(VERSION_V1) || version === BigInt(VERSION_V2C)) {
      parseCommunityMessage(data, outerRead, versionTlv, sink, Number(version));
    } else if (version === BigInt(VERSION_V3)) {
      parseV3Message(data, outerRead, versionTlv, sink);
    }
    // Tanınmayan sürümde gövde ÇÖZÜLMEZ: hangi şemayı uygulayacağı bilinmiyor.
  }

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: sink.fields,
    valid: sink.errors.length === 0,
    errors: sink.errors,
    warnings: sink.warnings,
  };

  return { success: true, frame, consumedBytes: outerRead.end };
}

export function parseSnmp(data: Uint8Array): ParseResult {
  return parseSnmpFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): SnmpParseOptions {
  const options: SnmpParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const snmpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: dış TLV SEQUENCE olmalı. Sürüm ve PDU tipi YOKLANMAZ —
   * ikisi de `parse`de uyarıyla geçebilen değerler alabilir. */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH && byteAt(data, 0) === TAG_SEQUENCE;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseSnmpFrame(data, readContextOptions(context));
  },
};

/** Kısa formda (uzunluk < 128) TLV kurar — örnekler bu sınırın altında kalıyor. */
function tlv(tag: number, value: readonly number[]): number[] {
  return [tag, value.length, ...value];
}

/** OID'i X.690 §8.19'a göre kodlar; testler ve örnekler aynı kaynaktan beslenir. */
function encodeOid(oid: string): number[] {
  const arcs = oid.split('.').map((arc) => Number(arc));
  const first = (arcs[0] ?? 0) * 40 + (arcs[1] ?? 0);
  const out: number[] = [];

  const pushBase128 = (value: number): void => {
    const chunks: number[] = [value & 0x7f];
    let remaining = Math.floor(value / 128);
    while (remaining > 0) {
      chunks.unshift((remaining & 0x7f) | 0x80);
      remaining = Math.floor(remaining / 128);
    }
    out.push(...chunks);
  };

  pushBase128(first);
  for (const arc of arcs.slice(2)) pushBase128(arc);
  return out;
}

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

/** İşaretli INTEGER — küçük pozitif değerler için tek bayt yeter. */
function integer(value: number): number[] {
  if (value >= 0 && value < 0x80) return tlv(0x02, [value]);
  if (value >= 0 && value < 0x8000) return tlv(0x02, [(value >>> 8) & 0xff, value & 0xff]);
  return tlv(0x02, [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function sequence(tag: number, children: readonly number[][]): number[] {
  return tlv(tag, children.flat());
}

const SYS_UP_TIME_OID = '1.3.6.1.2.1.1.3.0';
const SYS_DESCR_OID = '1.3.6.1.2.1.1.1.0';

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'get-request-v2c',
    name: 'protocol.snmp.example.getRequestV2c.name',
    bytes: Uint8Array.from(
      sequence(TAG_SEQUENCE, [
        integer(VERSION_V2C),
        tlv(TAG_OCTET_STRING, ascii('public')),
        sequence(PDU_GET_REQUEST, [
          integer(0x1234),
          integer(0), // error-status
          integer(0), // error-index
          sequence(TAG_SEQUENCE, [
            sequence(TAG_SEQUENCE, [tlv(TAG_OBJECT_IDENTIFIER, encodeOid(SYS_UP_TIME_OID)), tlv(TAG_NULL, [])]),
          ]),
        ]),
      ]),
    ),
    description: 'protocol.snmp.example.getRequestV2c.description',
    expectedValid: true,
  },
  {
    id: 'response-timeticks',
    name: 'protocol.snmp.example.responseTimeticks.name',
    // TimeTicks 360 000 = 1 saat; ham sayı saniye sanılırsa 100 saat çıkardı.
    bytes: Uint8Array.from(
      sequence(TAG_SEQUENCE, [
        integer(VERSION_V2C),
        tlv(TAG_OCTET_STRING, ascii('public')),
        sequence(PDU_RESPONSE, [
          integer(0x1234),
          integer(0),
          integer(0),
          sequence(TAG_SEQUENCE, [
            sequence(TAG_SEQUENCE, [
              tlv(TAG_OBJECT_IDENTIFIER, encodeOid(SYS_UP_TIME_OID)),
              tlv(TAG_TIME_TICKS, [0x00, 0x05, 0x7e, 0x40]),
            ]),
          ]),
        ]),
      ]),
    ),
    description: 'protocol.snmp.example.responseTimeticks.description',
    expectedValid: true,
  },
  {
    id: 'response-counter32-high',
    name: 'protocol.snmp.example.responseCounter32High.name',
    // Counter32 = 3 000 000 000: işaretli okunsa −1 294 967 296 görünürdü.
    bytes: Uint8Array.from(
      sequence(TAG_SEQUENCE, [
        integer(VERSION_V2C),
        tlv(TAG_OCTET_STRING, ascii('public')),
        sequence(PDU_RESPONSE, [
          integer(7),
          integer(0),
          integer(0),
          sequence(TAG_SEQUENCE, [
            sequence(TAG_SEQUENCE, [
              tlv(TAG_OBJECT_IDENTIFIER, encodeOid('1.3.6.1.2.1.2.2.1.10.1')),
              tlv(TAG_COUNTER32, [0xb2, 0xd0, 0x5e, 0x00]),
            ]),
          ]),
        ]),
      ]),
    ),
    description: 'protocol.snmp.example.responseCounter32High.description',
    expectedValid: true,
  },
  {
    id: 'get-bulk-request',
    name: 'protocol.snmp.example.getBulkRequest.name',
    // İkinci/üçüncü INTEGER error-status/index DEĞİL: non-repeaters=0, max-repetitions=10.
    bytes: Uint8Array.from(
      sequence(TAG_SEQUENCE, [
        integer(VERSION_V2C),
        tlv(TAG_OCTET_STRING, ascii('public')),
        sequence(PDU_GET_BULK_REQUEST, [
          integer(99),
          integer(0),
          integer(10),
          sequence(TAG_SEQUENCE, [
            sequence(TAG_SEQUENCE, [tlv(TAG_OBJECT_IDENTIFIER, encodeOid('1.3.6.1.2.1.2.2.1.2')), tlv(TAG_NULL, [])]),
          ]),
        ]),
      ]),
    ),
    description: 'protocol.snmp.example.getBulkRequest.description',
    expectedValid: true,
  },
  {
    id: 'trap-v1',
    name: 'protocol.snmp.example.trapV1.name',
    // v1 Trap-PDU: gövdesi standart PDU'yla hiçbir alanı paylaşmaz.
    bytes: Uint8Array.from(
      sequence(TAG_SEQUENCE, [
        integer(VERSION_V1),
        tlv(TAG_OCTET_STRING, ascii('public')),
        sequence(PDU_TRAP_V1, [
          tlv(TAG_OBJECT_IDENTIFIER, encodeOid('1.3.6.1.4.1.9')),
          tlv(TAG_IP_ADDRESS, [192, 168, 1, 10]),
          integer(2), // generic-trap = linkDown
          integer(0), // specific-trap
          tlv(TAG_TIME_TICKS, [0x00, 0x00, 0x27, 0x10]),
          sequence(TAG_SEQUENCE, [
            sequence(TAG_SEQUENCE, [
              tlv(TAG_OBJECT_IDENTIFIER, encodeOid('1.3.6.1.2.1.2.2.1.1.2')),
              tlv(TAG_INTEGER, [0x02]),
            ]),
          ]),
        ]),
      ]),
    ),
    description: 'protocol.snmp.example.trapV1.description',
    expectedValid: true,
  },
  {
    id: 'response-no-such-object',
    name: 'protocol.snmp.example.responseNoSuchObject.name',
    // v2c istisnası: etiket 0x80, uzunluk SIFIR — bilgi etiketin kendisinde.
    bytes: Uint8Array.from(
      sequence(TAG_SEQUENCE, [
        integer(VERSION_V2C),
        tlv(TAG_OCTET_STRING, ascii('public')),
        sequence(PDU_RESPONSE, [
          integer(5),
          integer(0),
          integer(0),
          sequence(TAG_SEQUENCE, [
            sequence(TAG_SEQUENCE, [
              tlv(TAG_OBJECT_IDENTIFIER, encodeOid('1.3.6.1.2.1.99.1.0')),
              tlv(TAG_NO_SUCH_OBJECT, []),
            ]),
          ]),
        ]),
      ]),
    ),
    description: 'protocol.snmp.example.responseNoSuchObject.description',
    expectedValid: true,
  },
  {
    id: 'v3-encrypted',
    name: 'protocol.snmp.example.v3Encrypted.name',
    // authPriv: zarf ve USM parametreleri okunur, ScopedPDU şifreli kalır.
    bytes: Uint8Array.from(
      sequence(TAG_SEQUENCE, [
        integer(VERSION_V3),
        sequence(TAG_SEQUENCE, [
          integer(0x3039), // msgID
          integer(0x1000), // msgMaxSize
          tlv(TAG_OCTET_STRING, [MSG_FLAG_AUTH | MSG_FLAG_PRIV | MSG_FLAG_REPORTABLE]),
          integer(3), // USM
        ]),
        tlv(
          TAG_OCTET_STRING,
          sequence(TAG_SEQUENCE, [
            tlv(TAG_OCTET_STRING, [0x80, 0x00, 0x1f, 0x88, 0x80, 0x01, 0x02, 0x03]),
            integer(12), // engineBoots
            integer(3600), // engineTime (SANİYE)
            tlv(TAG_OCTET_STRING, ascii('operator')),
            tlv(TAG_OCTET_STRING, [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55]),
            tlv(TAG_OCTET_STRING, [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
          ]),
        ),
        tlv(TAG_OCTET_STRING, [0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe]),
      ]),
    ),
    description: 'protocol.snmp.example.v3Encrypted.description',
    expectedValid: true,
  },
  {
    id: 'not-a-sequence',
    name: 'protocol.snmp.example.notASequence.name',
    // Dış TLV SEQUENCE değil — hata yolu.
    bytes: Uint8Array.from([0x02, 0x01, 0x01, 0x04, 0x06, ...ascii('public')]),
    description: 'protocol.snmp.example.notASequence.description',
    expectedValid: false,
  },
];

export const snmpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: snmpParser,
  documentation: {
    summary: 'protocol.snmp.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};

export { SYS_DESCR_OID, encodeOid };
