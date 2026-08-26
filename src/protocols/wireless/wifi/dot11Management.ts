/**
 * IEEE 802.11 **yönetim çerçevesi gövdeleri** (Faz 10, dalga 18b).
 *
 * `dot11Frame.ts` (18a) başlığı çözer, bu modül gövdenin SABİT alanlarını
 * basar ve kalanı `dot11Elements.ts`in TLV yürüyücüsüne devreder.
 *
 * ── GÖVDE YALNIZ MANAGEMENT'TA ÇÖZÜLÜR `[KARAR 18-2]` ─────────────────────
 * Control ve Data gövdeleri BU DALGADA DA AÇILMAZ: Block Ack bitmap'i, data
 * yükü ve QoS TID semantiği kapsam dışıdır. `Protected = 1` ise gövdeye HİÇ
 * İNİLMEZ — çağıran (`wifi.ts`) o kapıyı buradan ÖNCE kapatır.
 *
 * ── SABİT ALANLAR — alt tip başına ────────────────────────────────────────
 * | Alt tip | Sabit alanlar | Bayt |
 * |---|---|---|
 * | 0 Assoc Req      | Capability · Listen Interval | 4 |
 * | 1 Assoc Resp     | Capability · Status · AID | 6 |
 * | 2 Reassoc Req    | Capability · Listen Interval · Current AP Address | 10 |
 * | 3 Reassoc Resp   | Capability · Status · AID | 6 |
 * | 4 Probe Req      | — | 0 |
 * | 5 Probe Resp     | Timestamp · Beacon Interval · Capability | 12 |
 * | 8 Beacon         | Timestamp · Beacon Interval · Capability | 12 |
 * | 10 Disassoc      | Reason Code | 2 |
 * | 11 Auth          | Auth Algorithm · Auth Transaction Seq · Status | 6 |
 * | 12 Deauth        | Reason Code | 2 |
 * | 13/14 Action     | Category | 1 → **gerisi 18c'nin işi** |
 *
 * Tabloda OLMAYAN yönetim alt tipleri (6 Timing Advertisement, 9 ATIM ve
 * rezerve olanlar) **ADLANDIRILSA BİLE gövdeleri açılmaz**: yerleşimlerini
 * varsaymak `dot11Frame.ts`in "bilinmeyen control geometrisini uydurma"
 * kuralının yönetim düzeyindeki eşi olurdu.
 *
 * ── ARİTMETİK ÇAPRAZLAMA — brif ELLE çözdü, UYGULAMA YENİDEN ÇÖZDÜ ────────
 * Yedi gerçek çerçevede `24 + sabit + IE + 4 === n` bağımsız olarak
 * hesaplandı ve YEDİSİ DE TUTTU (Auth 34 · Disassoc 30 · Assoc Resp 58 ·
 * Assoc Req 79 · Probe Req 53 · Probe Resp 138 · Beacon 144). Brifin altı
 * satırlık tablosunda SAPMA BULUNMADI ve testi `dot11Management.test.ts`
 * bunu her koşuda yeniden üretir — dalga 17'nin "brifin elle çözümü bir bayt
 * atlıyordu" dersi bu turda da tekrarlamadı.
 *
 * ── Kod sözlükleri DAR ────────────────────────────────────────────────────
 * Status ve Reason tabloları kapalı, dar enum'lardır ve `[KANIT]`
 * `packet-ieee80211.c:1009` (`ieee80211_status_code`) ile `:938`
 * (`ieee80211_reason_code`) tablolarından alınmıştır. Tabloda OLMAYAN kod
 * HATA DEĞİLDİR — sayı basılır, ad UYDURULMAZ.
 */

import type { ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import { pushDot11Elements } from './dot11Elements';
import type { Dot11ElementOptions } from './dot11Elements';
import { formatMacAddress, pushField, toProtocolWarning } from './dot11Frame';
import type { Dot11HeaderSummary, FieldSink } from './dot11Frame';

const TRANSLATION_KEY_PREFIX = 'protocol.wifi';

export const WARN_MANAGEMENT_BODY_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.warning.managementBodyTruncated`;
export const WARN_MANAGEMENT_SUBTYPE_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.managementSubtypeNotDecoded`;
export const WARN_ACTION_BODY_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.actionBodyNotDecoded`;

const FIELD_WARN_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.field.managementBodyTruncated`;
const FIELD_WARN_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.field.managementBodyNotDecoded`;
const FIELD_WARN_UNKNOWN_CODE = `${TRANSLATION_KEY_PREFIX}.field.codeNotInTable`;

export const MGMT_ASSOCIATION_REQUEST = 0;
export const MGMT_ASSOCIATION_RESPONSE = 1;
export const MGMT_REASSOCIATION_REQUEST = 2;
export const MGMT_REASSOCIATION_RESPONSE = 3;
export const MGMT_PROBE_REQUEST = 4;
export const MGMT_PROBE_RESPONSE = 5;
export const MGMT_BEACON = 8;
export const MGMT_DISASSOCIATION = 10;
export const MGMT_AUTHENTICATION = 11;
export const MGMT_DEAUTHENTICATION = 12;
export const MGMT_ACTION = 13;
export const MGMT_ACTION_NO_ACK = 14;

/** Sabit alan türleri. Yerleşim VERİDİR, `FIXED_FIELD_PLAN`da yaşar. */
type FixedFieldKind =
  | 'timestamp'
  | 'beacon-interval'
  | 'capability'
  | 'listen-interval'
  | 'current-ap'
  | 'status-code'
  | 'aid'
  | 'auth-algorithm'
  | 'auth-sequence'
  | 'reason-code'
  | 'action-category';

const FIXED_FIELD_LENGTH: Readonly<Record<FixedFieldKind, number>> = {
  timestamp: 8,
  'beacon-interval': 2,
  capability: 2,
  'listen-interval': 2,
  'current-ap': 6,
  'status-code': 2,
  aid: 2,
  'auth-algorithm': 2,
  'auth-sequence': 2,
  'reason-code': 2,
  'action-category': 1,
};

/**
 * Alt tip → sabit alan dizisi. Burada OLMAYAN alt tipin gövdesi AÇILMAZ.
 * Action (13/14) yalnız Category taşır; gerisi 18c'nin işidir.
 */
const FIXED_FIELD_PLAN: ReadonlyMap<number, readonly FixedFieldKind[]> = new Map([
  [MGMT_ASSOCIATION_REQUEST, ['capability', 'listen-interval']],
  [MGMT_ASSOCIATION_RESPONSE, ['capability', 'status-code', 'aid']],
  [MGMT_REASSOCIATION_REQUEST, ['capability', 'listen-interval', 'current-ap']],
  [MGMT_REASSOCIATION_RESPONSE, ['capability', 'status-code', 'aid']],
  [MGMT_PROBE_REQUEST, []],
  [MGMT_PROBE_RESPONSE, ['timestamp', 'beacon-interval', 'capability']],
  [MGMT_BEACON, ['timestamp', 'beacon-interval', 'capability']],
  [MGMT_DISASSOCIATION, ['reason-code']],
  [MGMT_AUTHENTICATION, ['auth-algorithm', 'auth-sequence', 'status-code']],
  [MGMT_DEAUTHENTICATION, ['reason-code']],
  [MGMT_ACTION, ['action-category']],
  [MGMT_ACTION_NO_ACK, ['action-category']],
]);

/** Sabit alanlardan SONRA element zinciri gelir mi? Action'da GELMEZ. */
const ELEMENTS_FOLLOW: ReadonlySet<number> = new Set([
  MGMT_ASSOCIATION_REQUEST,
  MGMT_ASSOCIATION_RESPONSE,
  MGMT_REASSOCIATION_REQUEST,
  MGMT_REASSOCIATION_RESPONSE,
  MGMT_PROBE_REQUEST,
  MGMT_PROBE_RESPONSE,
  MGMT_BEACON,
  MGMT_DISASSOCIATION,
  MGMT_AUTHENTICATION,
  MGMT_DEAUTHENTICATION,
]);

/** Capability Information — 16 bit, little-endian. Bit sırası IEEE 9.4.1.4. */
export const CAPABILITY_BIT_NAMES: readonly string[] = [
  'ESS',
  'IBSS',
  'CF Pollable',
  'CF Poll Request',
  'Privacy',
  'Short Preamble',
  'PBCC',
  'Channel Agility',
  'Spectrum Management',
  'QoS',
  'Short Slot Time',
  'APSD',
  'Radio Measurement',
  'DSSS-OFDM',
  'Delayed Block Ack',
  'Immediate Block Ack',
];

export const CAPABILITY_PRIVACY_BIT = 4;

/** `[KANIT]` `packet-ieee80211.c:2101` `auth_alg`. */
const AUTH_ALGORITHM_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Open System'],
  [1, 'Shared Key'],
  [2, 'Fast BSS Transition'],
  [3, 'SAE'],
  [4, 'FILS Shared Key without PFS'],
  [5, 'FILS Shared Key with PFS'],
  [6, 'FILS Public Key'],
  [7, 'PASN'],
]);

/** `[KANIT]` `packet-ieee80211.c:1009` `ieee80211_status_code` — DAR alt küme. */
const STATUS_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Successful'],
  [1, 'Unspecified failure'],
  [5, 'Security disabled'],
  [6, 'Unacceptable lifetime'],
  [7, 'Not in same BSS'],
  [10, 'Cannot support all requested capabilities in the Capability Information field'],
  [11, 'Reassociation denied; cannot confirm that an association exists'],
  [12, 'Association denied for a reason outside the scope of the standard'],
  [13, 'Responding STA does not support the specified authentication algorithm'],
  [14, 'Authentication sequence number out of expected sequence'],
  [15, 'Authentication rejected because of challenge failure'],
  [16, 'Authentication rejected due to timeout waiting for the next frame'],
  [17, 'Association denied; the AP cannot handle additional associated STAs'],
  [18, 'Association denied; the STA does not support all data rates in the BSSBasicRateSet'],
  [19, 'Association denied; the STA does not support the short preamble option'],
  [22, 'Association rejected; spectrum management capability is required'],
  [25, 'Association denied; the STA does not support short slot time'],
  [27, 'Association denied; the STA does not support HT features'],
  [30, 'Association request rejected temporarily; try again later'],
  [31, 'Robust management frame policy violation'],
  [40, 'Invalid element'],
  [41, 'Invalid group cipher'],
  [42, 'Invalid pairwise cipher'],
  [43, 'Invalid AKMP'],
  [44, 'Unsupported RSNE version'],
]);

/** `[KANIT]` `packet-ieee80211.c:938` `ieee80211_reason_code` — DAR alt küme. */
const REASON_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'Unspecified reason'],
  [2, 'Previous authentication no longer valid'],
  [3, 'Deauthenticated because the sending STA is leaving the BSS'],
  [4, 'Disassociated due to inactivity'],
  [5, 'Disassociated; the AP cannot handle all currently associated STAs'],
  [6, 'Class 2 frame received from a nonauthenticated STA'],
  [7, 'Class 3 frame received from a nonassociated STA'],
  [8, 'Disassociated because the sending STA is leaving the BSS'],
  [9, 'STA requesting (re)association is not authenticated'],
  [13, 'Invalid information element'],
  [14, 'Message integrity code (MIC) failure'],
  [15, '4-way handshake timeout'],
  [16, 'Group key handshake timeout'],
  [17, 'Element in the 4-way handshake differs from the (Re)Association Request / Beacon'],
  [18, 'Invalid group cipher'],
  [19, 'Invalid pairwise cipher'],
  [20, 'Invalid AKMP'],
  [21, 'Unsupported RSNE version'],
  [22, 'Invalid RSNE capabilities'],
  [23, 'IEEE 802.1X authentication failed'],
  [24, 'Cipher suite rejected because of the security policy'],
]);

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

function readUint64Le(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let index = 7; index >= 0; index -= 1) {
    value = (value << 8n) | BigInt(byteAt(data, offset + index));
  }
  return value;
}

function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

export interface Dot11ManagementPlan {
  readonly subtype: number;
  readonly fixedFields: readonly FixedFieldKind[];
  readonly fixedLength: number;
  readonly elementsFollow: boolean;
  /** Alt tip sabit alan tablosunda VAR mı? Yoksa gövde ham kalır. */
  readonly known: boolean;
}

/**
 * Alt tipin gövde yerleşimini SAF olarak planlar. `dot11Management.test.ts`
 * aritmetik çaprazlamayı doğrudan bunun üzerinden yapar.
 */
export function planManagementBody(subtype: number): Dot11ManagementPlan {
  const fixedFields = FIXED_FIELD_PLAN.get(subtype);
  if (fixedFields === undefined) {
    return { subtype, fixedFields: [], fixedLength: 0, elementsFollow: false, known: false };
  }
  const fixedLength = fixedFields.reduce((total, kind) => total + FIXED_FIELD_LENGTH[kind], 0);
  return {
    subtype,
    fixedFields,
    fixedLength,
    elementsFollow: ELEMENTS_FOLLOW.has(subtype),
    known: true,
  };
}

export function describeCapabilities(value: number): string {
  const set = CAPABILITY_BIT_NAMES.filter((_, bit) => (value & (1 << bit)) !== 0);
  return set.length === 0 ? 'no capability bits set' : set.join(', ');
}

function codeText(code: number, table: ReadonlyMap<number, string>): { text: string; known: boolean } {
  const name = table.get(code);
  return name === undefined
    ? { text: `${String(code)} (not in this release's table)`, known: false }
    : { text: `${String(code)} — ${name}`, known: true };
}

function pushFixedField(
  data: Uint8Array,
  sink: FieldSink,
  kind: FixedFieldKind,
  offset: number,
): void {
  const length = FIXED_FIELD_LENGTH[kind];
  const rawBytes = data.slice(offset, offset + length);

  switch (kind) {
    case 'timestamp': {
      const value = readUint64Le(data, offset);
      pushField(sink, {
        id: 'mgmt-timestamp',
        name: '802.11 · Timestamp (TSF)',
        offset,
        length,
        rawBytes,
        rawValue: value,
        physicalValue: value.toString(),
        unit: 'µs',
        valid: true,
        warnings: [],
      });
      return;
    }
    case 'beacon-interval': {
      const value = readUint16Le(data, offset);
      pushField(sink, {
        id: 'mgmt-beacon-interval',
        name: '802.11 · Beacon Interval (TU = 1024 µs)',
        offset,
        length,
        rawBytes,
        rawValue: value,
        physicalValue: value,
        unit: 'TU',
        valid: true,
        warnings: [],
      });
      return;
    }
    case 'capability': {
      const value = readUint16Le(data, offset);
      pushField(sink, {
        id: 'mgmt-capability',
        name: '802.11 · Capability Information',
        offset,
        length,
        rawBytes,
        rawValue: `0x${value.toString(16).toUpperCase().padStart(4, '0')}`,
        physicalValue: describeCapabilities(value),
        valid: true,
        warnings: [],
      });
      // Privacy AYRI bir satır: güvenlik anlatısının tamamı bu bite asılı ve
      // "kurulu bayrakları say" biçimi bitin SIFIR olduğunu GÖSTEREMEZ.
      const privacy = (value & (1 << CAPABILITY_PRIVACY_BIT)) !== 0;
      pushField(sink, {
        id: 'mgmt-capability-privacy',
        name: '802.11 · Capability Information · Privacy',
        offset,
        length,
        rawBytes,
        rawValue: privacy ? 1 : 0,
        physicalValue: privacy
          ? '1 — WEP/TKIP/CCMP required on this BSS'
          : '0 — open network, no link-layer encryption',
        valid: true,
        warnings: [],
      });
      return;
    }
    case 'listen-interval': {
      const value = readUint16Le(data, offset);
      pushField(sink, {
        id: 'mgmt-listen-interval',
        name: '802.11 · Listen Interval',
        offset,
        length,
        rawBytes,
        rawValue: value,
        // Birim YOK ve bilerek yok: bu bir SAYIM (kaç beacon aralığı), fiziksel
        // bir süre değil. Süreye çevirmek Beacon Interval'ı BİLİYOR olmayı
        // gerektirir ve bu çerçeve onu taşımaz.
        physicalValue: `${String(value)} beacon interval(s)`,
        valid: true,
        warnings: [],
      });
      return;
    }
    case 'current-ap': {
      pushField(sink, {
        id: 'mgmt-current-ap',
        name: '802.11 · Current AP Address',
        offset,
        length,
        rawBytes,
        rawValue: formatMacAddress(rawBytes),
        physicalValue: formatMacAddress(rawBytes),
        valid: true,
        warnings: [],
      });
      return;
    }
    case 'status-code': {
      const value = readUint16Le(data, offset);
      const text = codeText(value, STATUS_CODE_NAMES);
      pushField(sink, {
        id: 'mgmt-status-code',
        name: '802.11 · Status Code',
        offset,
        length,
        rawBytes,
        rawValue: value,
        physicalValue: text.text,
        valid: true,
        warnings: text.known ? [] : [FIELD_WARN_UNKNOWN_CODE],
      });
      return;
    }
    case 'aid': {
      const value = readUint16Le(data, offset);
      // Üst iki bit her zaman 1'dir (802.11 9.4.1.8); AID 14 bittir.
      pushField(sink, {
        id: 'mgmt-aid',
        name: '802.11 · Association ID (AID)',
        offset,
        length,
        rawBytes,
        rawValue: `0x${value.toString(16).toUpperCase().padStart(4, '0')}`,
        physicalValue: `${String(value & 0x3fff)} (the top two bits are set to 1 by the standard)`,
        valid: true,
        warnings: [],
      });
      return;
    }
    case 'auth-algorithm': {
      const value = readUint16Le(data, offset);
      const name = AUTH_ALGORITHM_NAMES.get(value);
      pushField(sink, {
        id: 'mgmt-auth-algorithm',
        name: '802.11 · Authentication Algorithm',
        offset,
        length,
        rawBytes,
        rawValue: value,
        physicalValue:
          name === undefined ? `${String(value)} (not in this release's table)` : `${String(value)} — ${name}`,
        valid: true,
        warnings: name === undefined ? [FIELD_WARN_UNKNOWN_CODE] : [],
      });
      return;
    }
    case 'auth-sequence': {
      const value = readUint16Le(data, offset);
      pushField(sink, {
        id: 'mgmt-auth-sequence',
        name: '802.11 · Authentication Transaction Sequence Number',
        offset,
        length,
        rawBytes,
        rawValue: value,
        physicalValue: value,
        valid: true,
        warnings: [],
      });
      return;
    }
    case 'reason-code': {
      const value = readUint16Le(data, offset);
      const text = codeText(value, REASON_CODE_NAMES);
      pushField(sink, {
        id: 'mgmt-reason-code',
        name: '802.11 · Reason Code',
        offset,
        length,
        rawBytes,
        rawValue: value,
        physicalValue: text.text,
        valid: true,
        warnings: text.known ? [] : [FIELD_WARN_UNKNOWN_CODE],
      });
      return;
    }
    case 'action-category': {
      const value = byteAt(data, offset);
      pushField(sink, {
        id: 'mgmt-action-category',
        name: '802.11 · Action · Category',
        offset,
        length,
        rawBytes,
        rawValue: value,
        // Kategori sözlüğü BASILMAZ: her kategorinin KENDİ gövde yerleşimi var
        // ve onları çözmek 18c'nin işi. Sayıyı basıp adı uydurmamak doğru olan.
        physicalValue: `category ${String(value)} — the action body layout is category specific and is not decoded here`,
        valid: true,
        warnings: [FIELD_WARN_NOT_DECODED],
      });
      return;
    }
  }
}

/**
 * Yönetim gövdesini çözer.
 *
 * Sözleşme: çağıran `summary.frameClass === 'management'` ve
 * `summary.protectedFrame === false` olduğunu ZATEN doğrulamıştır; FCS
 * `pushDot11Fcs` ile EN SONA bırakılır.
 *
 * Dönen değer: gövde gerçekten çözüldü mü (`false` ise çağıran ham gövde
 * alanını ve `bodyNotDecoded` uyarısını kendisi basar).
 */
export function decodeDot11ManagementBody(
  data: Uint8Array,
  sink: FieldSink,
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  summary: Dot11HeaderSummary,
  options: Dot11ElementOptions,
): boolean {
  const plan = planManagementBody(summary.frameControl.subtype);
  const bodyStart = summary.bodyOffset;
  const bodyEnd = summary.bodyOffset + summary.bodyLength;

  if (!plan.known) {
    warnings.push(
      toProtocolWarning(
        'managementSubtypeNotDecoded',
        WARN_MANAGEMENT_SUBTYPE_NOT_DECODED,
        bodyStart,
        summary.bodyLength,
      ),
    );
    return false;
  }

  if (summary.bodyLength < plan.fixedLength) {
    // Sabit alanlar SIĞMIYOR. Yarısını basıp gerisini uydurmak yerine gövde
    // HAM bırakılır: kısa bir gövdede alanları kaydırarak okumak tam olarak
    // "sessizce yanlış" davranıştır.
    warnings.push(
      toProtocolWarning(
        'managementBodyTruncated',
        WARN_MANAGEMENT_BODY_TRUNCATED,
        bodyStart,
        summary.bodyLength,
      ),
    );
    pushField(sink, {
      id: 'mgmt-body-truncated',
      name: '802.11 · Frame Body (too short for the fixed fields)',
      offset: bodyStart,
      length: summary.bodyLength,
      rawBytes: data.slice(bodyStart, bodyEnd),
      rawValue: hexBytes(data.slice(bodyStart, bodyEnd)),
      physicalValue: `${String(summary.bodyLength)} B present, ${String(plan.fixedLength)} B of fixed fields required`,
      valid: false,
      warnings: [FIELD_WARN_TRUNCATED],
    });
    return true;
  }

  let cursor = bodyStart;
  for (const kind of plan.fixedFields) {
    pushFixedField(data, sink, kind, cursor);
    cursor += FIXED_FIELD_LENGTH[kind];
  }

  if (plan.elementsFollow) {
    if (cursor < bodyEnd) pushDot11Elements(data, sink, warnings, errors, cursor, bodyEnd, options);
    return true;
  }

  // Action (13/14): Category basıldı, gerisi 18c'nin işi.
  if (cursor < bodyEnd) {
    pushField(sink, {
      id: 'mgmt-action-body',
      name: '802.11 · Action · body (not decoded)',
      offset: cursor,
      length: bodyEnd - cursor,
      rawBytes: data.slice(cursor, bodyEnd),
      rawValue: hexBytes(data.slice(cursor, bodyEnd)),
      physicalValue: `${String(bodyEnd - cursor)} B left raw — the action body layout depends on the category`,
      valid: true,
      warnings: [FIELD_WARN_NOT_DECODED],
    });
    warnings.push(
      toProtocolWarning(
        'actionBodyNotDecoded',
        WARN_ACTION_BODY_NOT_DECODED,
        cursor,
        bodyEnd - cursor,
      ),
    );
  }
  return true;
}
