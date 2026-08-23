/**
 * POWERLINK'in üç motor dosyasının (`powerlink.ts`, `powerlinkAsnd.ts`,
 * `powerlinkSdo.ts`) ORTAK zemini: little-endian okuyucular, alan itme
 * yardımcıları, node adres etiketleri ve NMT durum tablosu.
 *
 * Neden ayrı dosya: bu üçlü birbirini import ediyor (`powerlink.ts` →
 * `powerlinkAsnd.ts` → `powerlinkSdo.ts`). Yardımcılar ana dosyada dursaydı
 * döngüsel bağımlılık olurdu; her dosyaya kopyalansaydı ÜÇ ayrı LE okuyucu
 * doğardı ve biri düzeltilince ötekiler geride kalırdı. `profinetDcp.ts` iki
 * dosya için kopyalamayı seçmişti; burada üç tüketici ve ortak bir NMT tablosu
 * var, bu yüzden tek kaynak tercih edildi.
 *
 * ── ENDIANNESS ──────────────────────────────────────────────────────────────
 * Ethernet başlığı NETWORK ORDER (big-endian) okunur ve o iş
 * `ethernetFrame.ts`e aittir. EtherType'tan SONRA POWERLINK'in TAMAMI
 * LITTLE-ENDIAN'dır — iki kaynak da böyle: W (Wireshark `packet-epl.c`) her
 * `proto_tree_add_item` çağrısında `ENC_LITTLE_ENDIAN` kullanır, O
 * (openPOWERLINK `frame.h`) her çok baytlı alanı `...Le` sonekiyle adlandırır
 * (`sizeLe`, `featureFlagsLe`, `relativeTimeLe`). Bu yüzden bu dosyada
 * big-endian bir okuyucu YOKTUR: yanlışlıkla çağrılamasın.
 */

import type { ParsedField } from '@/protocol-core/types';

const HEX_RADIX = 16;

/** `noUncheckedIndexedAccess` açık — sınır dışı okuma 0 sayılır, guard burada. */
export function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

export function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

/** `>>> 0` şart: `<< 24` işareti taşar ve negatif sayı üretir. */
export function readUint32Le(data: Uint8Array, offset: number): number {
  return (
    (byteAt(data, offset) |
      (byteAt(data, offset + 1) << 8) |
      (byteAt(data, offset + 2) << 16) |
      (byteAt(data, offset + 3) << 24)) >>>
    0
  );
}

/**
 * 64-bit alanlar `bigint` döner: POWERLINK'in RelativeTime'ı mikrosaniye
 * sayacıdır ve `number`ın güvenli tamsayı sınırını (2^53) aşabilir. `ParsedField`
 * sözleşmesi `bigint`i zaten kabul ediyor (types.ts `rawValue`).
 */
export function readUint64Le(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let index = 7; index >= 0; index -= 1) {
    value = (value << 8n) | BigInt(byteAt(data, offset + index));
  }
  return value;
}

export function formatHex(value: number, digits: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(digits, '0')}`;
}

/** Tek bitlik bayrak alanı — id çağıranın ofsetinden türer, KOPYALANMAZ. */
export function pushBitField(
  fields: ParsedField[],
  data: Uint8Array,
  init: {
    readonly id: string;
    readonly name: string;
    readonly offset: number;
    readonly value: number;
    readonly mask: number;
    readonly onLabel: string;
    readonly offLabel: string;
    readonly warnings?: readonly string[];
  },
): void {
  const set = (init.value & init.mask) !== 0;
  fields.push({
    id: init.id,
    name: init.name,
    offset: init.offset,
    length: 1,
    rawBytes: data.slice(init.offset, init.offset + 1),
    rawValue: set ? 1 : 0,
    physicalValue: set ? init.onLabel : init.offLabel,
    valid: true,
    warnings: init.warnings === undefined ? [] : [...init.warnings],
  });
}

/** Çok bitlik sayısal alt-alan (ör. PR = bit 3-5). */
export function pushMaskedField(
  fields: ParsedField[],
  data: Uint8Array,
  init: {
    readonly id: string;
    readonly name: string;
    readonly offset: number;
    readonly value: number;
    readonly mask: number;
    readonly shift: number;
    readonly physicalValue?: string;
  },
): void {
  const field: ParsedField = {
    id: init.id,
    name: init.name,
    offset: init.offset,
    length: 1,
    rawBytes: data.slice(init.offset, init.offset + 1),
    rawValue: (init.value & init.mask) >>> init.shift,
    valid: true,
    warnings: [],
  };
  if (init.physicalValue !== undefined) field.physicalValue = init.physicalValue;
  fields.push(field);
}

/** Adlandırılamayan bölge — TEK PARÇA ham. Uzunluk ≤ 0 ise hiç basılmaz. */
export function pushRawBlock(
  fields: ParsedField[],
  data: Uint8Array,
  init: {
    readonly id: string;
    readonly name: string;
    readonly offset: number;
    readonly length: number;
    readonly warnings?: readonly string[];
  },
): void {
  if (init.length <= 0) return;
  fields.push({
    id: init.id,
    name: init.name,
    offset: init.offset,
    length: init.length,
    rawBytes: data.slice(init.offset, init.offset + init.length),
    unit: 'B',
    valid: true,
    warnings: init.warnings === undefined ? [] : [...init.warnings],
  });
}

/** Sabit genişlikli sayısal alan (LE). `length` 1/2/4 olabilir. */
export function pushNumericField(
  fields: ParsedField[],
  data: Uint8Array,
  init: {
    readonly id: string;
    readonly name: string;
    readonly offset: number;
    readonly length: 1 | 2 | 4;
    readonly physicalValue?: string;
    readonly unit?: string;
    readonly warnings?: readonly string[];
  },
): number {
  const value =
    init.length === 1
      ? byteAt(data, init.offset)
      : init.length === 2
        ? readUint16Le(data, init.offset)
        : readUint32Le(data, init.offset);
  const field: ParsedField = {
    id: init.id,
    name: init.name,
    offset: init.offset,
    length: init.length,
    rawBytes: data.slice(init.offset, init.offset + init.length),
    rawValue: value,
    valid: true,
    warnings: init.warnings === undefined ? [] : [...init.warnings],
  };
  // `unit` fiziksel değere YAPIŞTIRILIR (DecodePanel kuralı): zaten biçimlenmiş
  // bir `physicalValue` varsa birim VERİLMEZ, yoksa birim tek başına basılmaz.
  if (init.physicalValue !== undefined) field.physicalValue = init.physicalValue;
  else if (init.unit !== undefined) {
    field.physicalValue = String(value);
    field.unit = init.unit;
  }
  fields.push(field);
  return value;
}

/**
 * POWERLINK node adres kümesi. İKİ KAYNAKTA BİREBİR:
 * W `EPL_DYNAMIC_NODEID 0` / `EPL_MN_NODEID 240` / `EPL_DIAGNOSTIC_DEVICE_NODEID
 * 253` / `EPL_TO_LEGACY_ETHERNET_ROUTER_NODEID 254` / `EPL_BROADCAST_NODEID 255`;
 * O `oplkinc.h`/`frame.h` aynı sabitleri `C_ADR_*` adıyla taşır.
 */
export const NODE_ID_MN = 240;
const NODE_ID_LABELS: ReadonlyMap<number, string> = new Map([
  [0, 'Dynamically assigned'],
  [240, 'Managing Node (MN)'],
  [253, 'Diagnostic Device'],
  [254, 'POWERLINK to legacy Ethernet Router'],
  [255, 'Broadcast'],
]);

/**
 * 1-239 bandı Controlled Node'lara ayrılmıştır; 241-252 spec'te ayrılmış.
 * Adlandırma yalnız iki kaynağın da verdiği değerler için yapılır.
 */
export function describeNodeId(nodeId: number): string {
  const named = NODE_ID_LABELS.get(nodeId);
  if (named !== undefined) return named;
  if (nodeId >= 1 && nodeId <= 239) return `Controlled Node (CN) ${nodeId}`;
  return `Reserved (${nodeId})`;
}

/**
 * NMT durum baytı. İKİ KAYNAKTA BİREBİR AYNI DEĞERLER:
 * W `epl_nmt_cs_vals` / `epl_nmt_ms_vals`; O `nmt.h` `tNmtState` (üst bayt
 * rol ayrımı, ALT BAYT tel üstündeki değer: `kNmtCsOperational = 0x01FD` →
 * 0xFD). Aynı bayt MN'den geldiğinde MS_, CN'den geldiğinde CS_ önekiyle
 * okunur — ayrım kaynak node id'sinden (240 = MN) gelir, çerçevede ayrı bir
 * alan YOKTUR (W bunu `pinfo->srcport != EPL_MN_NODEID` ile yapıyor).
 *
 * DİKKAT — CANopen ile ORTAK DEĞİL: CiA 301'in heartbeat durumları
 * {0x00 Boot-up, 0x04 Stopped, 0x05 Operational, 0x7F Pre-operational}
 * (`canopen.ts` `NMT_STATE_LABELS`). Kesişim BOŞ; 0x00 ikisinde de var ama
 * ANLAMI farklı (CANopen "Boot-up", POWERLINK "NMT_GS_OFF"). Paylaşım kararı
 * için bkz. `powerlink.ts` dosya başı.
 */
const NMT_STATE_COMMON: ReadonlyMap<number, string> = new Map([
  [0x00, 'NMT_GS_OFF'],
  [0x19, 'NMT_GS_INITIALIZING'],
  [0x29, 'NMT_GS_RESET_APPLICATION'],
  [0x39, 'NMT_GS_RESET_COMMUNICATION'],
]);

const NMT_STATE_ROLE_SPECIFIC: ReadonlyMap<number, string> = new Map([
  [0x1c, 'NOT_ACTIVE'],
  [0x1d, 'PRE_OPERATIONAL_1'],
  [0x1e, 'BASIC_ETHERNET'],
  [0x4d, 'STOPPED'],
  [0x5d, 'PRE_OPERATIONAL_2'],
  [0x6d, 'READY_TO_OPERATE'],
  [0xfd, 'OPERATIONAL'],
]);

export interface NmtStateLabel {
  readonly label: string;
  readonly known: boolean;
}

/**
 * `isManagingNode` kaynak node id'sinden gelir. STOPPED yalnız CN tarafında
 * tanımlıdır (W'nin `epl_nmt_ms_vals` tablosunda 0x4D YOKTUR) — MN'den 0x4D
 * gelirse "bilinmiyor" sayılır ve uyarı basılır.
 */
export function describeNmtState(state: number, isManagingNode: boolean): NmtStateLabel {
  const common = NMT_STATE_COMMON.get(state);
  if (common !== undefined) return { label: common, known: true };
  const specific = NMT_STATE_ROLE_SPECIFIC.get(state);
  if (specific === undefined) return { label: formatHex(state, 2), known: false };
  if (specific === 'STOPPED' && isManagingNode) {
    return { label: formatHex(state, 2), known: false };
  }
  return { label: `NMT_${isManagingNode ? 'MS' : 'CS'}_${specific}`, known: true };
}

/**
 * PDOVersion ve POWERLINKVersion aynı biçimi paylaşır: üst nibble ana sürüm,
 * alt nibble alt sürüm (O `PLK_VERSION_MAIN 0xF0` / `PLK_VERSION_SUB 0x0F`;
 * W `hi_nibble()/lo_nibble()` ile aynı okumayı yapar).
 */
export function formatVersionNibbles(value: number): string {
  return `${(value >>> 4) & 0x0f}.${value & 0x0f}`;
}
