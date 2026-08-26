/**
 * 6LoWPAN adaptasyon katmanı — dispatch zinciri, IPHC ve NHC-UDP
 * (Faz 10, dalga 18d).
 *
 * `mle.ts`i **import ETMEZ** ve etmemelidir: 6LoWPAN MLE'yi bilmez, MLE de
 * 6LoWPAN'ı. İkisini `thread.ts` sıralar (dalga 17'nin `cnip.ts`/`lonTalk.ts`
 * ayrımı emsal).
 *
 * ── DISPATCH ZİNCİRİ (RFC 4944 §5.1 + RFC 6282 §3.1) ──────────────────────
 * Başlık yığını SIRALI okunur: Mesh → Broadcast → Fragment → IPHC/IPv6.
 * ```
 * | 00  xxxxxx | NALP       - Not a LoWPAN frame               |
 * | 01  000001 | IPv6       - Uncompressed IPv6 Addresses      |
 * | 01  000010 | LOWPAN_HC1 - LOWPAN_HC1 compressed IPv6       |
 * | 01  010000 | LOWPAN_BC0 - LOWPAN_BC0 broadcast             |
 * | 10  xxxxxx | MESH       - Mesh Header                      |
 * | 11  000xxx | FRAG1      - Fragmentation Header (first)     |
 * | 11  100xxx | FRAGN      - Fragmentation Header (subsequent)|
 * ```
 * `[KANIT]` RFC 4944 §5.1 Figure 2 (birebir). RFC 6282 §5 IPHC için
 * `01 100000`–`01 111111` aralığını (yani `011 xxxxx`) tahsis eder ve
 * **RFC 4944'ün `01 111111` ESC'sini `01 000000`a taşır** `[KANIT]`
 * RFC 6282 §2 satır 247-249. İki RFC'nin bu noktada ÇELİŞMESİ
 * `dispatchProfile` kanalının VAR OLMA sebebidir: `0x7F` baytı `thread`
 * profilinde IPHC, `rfc4944-full` profilinde ESC'tir ve ESC bir EK DISPATCH
 * BAYTI TÜKETİR — kanal çıktıyı BAYT DÜZEYİNDE değiştirir, bir görüntü
 * tercihi değildir.
 *
 * ── KAPSAM DIŞI — açıkça ──────────────────────────────────────────────────
 *   · **Fragment yeniden birleştirme** — çerçeveler arası durum (dalga 16
 *     bulgu 12). FRAG1/FRAGN BAŞLIKLARI çözülür, "bu çerçeve datagram'ın
 *     neresinde" basılır; tampon TUTULMAZ.
 *   · **LOWPAN_HC1 / HC2 gövdesi** (dispatch `0x42`) — RFC 4944 §10'un eski
 *     sıkıştırması, RFC 6282 IPHC'siyle DEĞİŞTİRİLDİ ve Thread KULLANMAZ.
 *     Tanınır ve ADLANDIRILIR, ÇÖZÜLMEZ. Gerçek yakalamada 331 çerçevenin
 *     33'ü HC1'di; `canParse` onları REDDEDER ve bu bilinçli bir kapsam
 *     kararıdır, yanlış negatif değildir.
 *   · **NHC genişletme başlıkları** (`1110 xxxx`: Hop-by-Hop, Routing,
 *     Fragment, Destination Options, Mobility, IPv6 tünel) — yalnız
 *     **NHC-UDP** (`11110 CPP`) çözülür. Öteki NHC kodları TANINIR, gövdeleri
 *     ÇÖZÜLMEZ; zincir orada durur.
 *   · **Bağlam tabanlı sıkıştırma (SAC/DAC = 1)** — bağlam tablosu TELDE
 *     YOKTUR; adres HAM kalır + uyarı. Aşağıda gerekçesi.
 *   · **UDP checksum doğrulaması** — checksum kapsamı IPv6 sözde başlığıdır
 *     (kaynak/hedef adres + uzunluk + next header); IPHC'de adreslerin bir
 *     kısmı TÜRETİLMİŞTİR ve NHC'de UDP Length TELDE HİÇ YOKTUR
 *     (RFC 6282 §4.3.3: *"The UDP Length field MUST always be elided"*).
 *     Türetilmiş girdiden hesaplanan bir PASS/FAIL ölçüm değildir — dalga 13
 *     dersi 3. Checksum bir ALAN olarak basılır, doğrulanmaz.
 *
 * ── 🚨 BAĞLAM TABLOSU TELDE YOK ──────────────────────────────────────────
 * SAC/DAC = 1 bağlam tabanlı sıkıştırmadır ve adres, telde OLMAYAN bir bağlam
 * tablosundan (Context ID → prefix) kurulur. Dalga 17'nin *"Semantik tip telde
 * olmayabilir"* dersinin (LonTalk NV selector) adres düzeyindeki eşi: satır içi
 * bitler basılır, adres KURULMAZ, `contextNotOnWire` uyarısı düşer.
 *
 * **Brifin öngördüğü `iphcContext` KANALI AÇILMADI** ve gerekçesi ölçülebilir:
 * `DecodeOption.kind` yalnız `'select' | 'number'` (`protocol-core/types.ts`),
 * serbest metin kipi YOKTUR ve 18d'nin kabul ölçütü `types.ts`e dokunmayı
 * AÇIKÇA yasaklıyor. Bir IPv6 prefix'i ne sonlu bir şıkka ne bir sayıya sığar;
 * uydurma bir şık listesi "bu tablo tam" izlenimi verirdi. Kanal açılmadığında
 * davranış zaten brifin *"seçilmezse adres HAM kalır + uyarı"* dalıdır.
 *
 * ── IID TÜRETİMİ BİR ÖLÇÜM DEĞİL, BİR BİLDİRİMDİR ────────────────────────
 * SAM/DAM = `11` adresi TAMAMEN elenmiştir ve IID kapsülleyen 802.15.4
 * başlığından türetilir `[KANIT]` RFC 6282 §3.2.2: *"The only change needed to
 * transform an IEEE EUI-64 identifier to an interface identifier is to invert
 * the universal/local bit."* Türetilen adres basılır ama `iidDerived`
 * uyarısıyla İŞARETLENİR — telde okunmuş bir değer DEĞİLDİR.
 */

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

// ── `decodeOptions` sabitleri ─────────────────────────────────────────────

export const DISPATCH_PROFILE_THREAD = 'thread';
export const DISPATCH_PROFILE_RFC4944 = 'rfc4944-full';

export const UDP_CHECKSUM_AUTO = 'auto';
export const UDP_CHECKSUM_PRESENT = 'present';
export const UDP_CHECKSUM_ELIDED = 'elided';

export const ADDRESS_DISPLAY_EUI64 = 'eui64';
export const ADDRESS_DISPLAY_RAW = 'raw';

// ── Dispatch sabitleri ────────────────────────────────────────────────────

export const DISPATCH_IPV6 = 0x41;
export const DISPATCH_HC1 = 0x42;
export const DISPATCH_BC0 = 0x50;
/** RFC 6282'nin ESC yer değiştirmesi (`01 000000`). */
export const DISPATCH_ESC_6282 = 0x40;
/** RFC 4944'ün özgün ESC'si (`01 111111`) — `rfc4944-full` profilinde. */
export const DISPATCH_ESC_4944 = 0x7f;

export const IPV6_HEADER_LENGTH = 40;
export const UDP_HEADER_LENGTH = 8;

// ── Mesajlar ──────────────────────────────────────────────────────────────

export interface LowpanMessages {
  readonly truncated: string;
  readonly hc1OutOfScope: string;
  readonly nalp: string;
  readonly escNotAllocated: string;
  readonly unknownDispatch: string;
  readonly fragmentNotReassembled: string;
  readonly contextNotOnWire: string;
  readonly iidDerived: string;
  readonly reservedAddressMode: string;
  readonly nhcNotUdp: string;
  readonly udpChecksumNotVerified: string;
  readonly udpChecksumElidedOnWire: string;
}

export interface LowpanOptions {
  readonly dispatchProfile: string;
  readonly udpChecksumElided: string;
  readonly addressDisplay: string;
}

export interface LowpanUdp {
  readonly sourcePort: number;
  readonly destinationPort: number;
  readonly payloadStart: number;
  readonly payloadEnd: number;
}

export interface LowpanFragment {
  readonly datagramSize: number;
  readonly datagramTag: number;
  /** FRAG1'de `0`, FRAGN'de `datagram_offset × 8`. */
  readonly datagramOffset: number;
  readonly first: boolean;
}

export interface LowpanSummary {
  /** Okunan dispatch başlıklarının adları, SIRAYLA. */
  readonly headers: readonly string[];
  /** Kapsam dışı bir dala girildiyse adı; zincir orada DURDU. */
  readonly outOfScope: string | undefined;
  readonly fragment: LowpanFragment | undefined;
  readonly udp: LowpanUdp | undefined;
  /** Zincirin ulaştığı MUTLAK ofset. */
  readonly cursor: number;
  /** Yükün başladığı MUTLAK ofset (`udp` varsa `udp.payloadStart`). */
  readonly payloadStart: number;
  readonly payloadEnd: number;
}

// ── Temel okuyucular ──────────────────────────────────────────────────────

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toHex(value: number, byteWidth: number): string {
  return `0x${value.toString(16).padStart(byteWidth * 2, '0').toUpperCase()}`;
}

function readUint16Be(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

/** Telde LE; ekranda geleneksel EUI-64 (ters/ayraçlı) ya da HAM tel sırası. */
export function formatLinkAddress(bytes: Uint8Array, display: string): string {
  if (display === ADDRESS_DISPLAY_RAW) return hexBytes(bytes);
  if (bytes.length === 2) return toHex((byteAt(bytes, 1) << 8) | byteAt(bytes, 0), 2);
  return Array.from(bytes)
    .reverse()
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

/** RFC 5952 tarzı en uzun sıfır dizisini `::` ile kısaltan gösterim. */
export function formatIpv6(bytes: Uint8Array): string {
  const groups: number[] = [];
  for (let i = 0; i < 8; i += 1) groups.push((byteAt(bytes, i * 2) << 8) | byteAt(bytes, i * 2 + 1));
  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;
  for (let i = 0; i < 9; i += 1) {
    const zero = i < 8 && groups[i] === 0;
    if (zero && runStart === -1) runStart = i;
    if (!zero && runStart !== -1) {
      const length = i - runStart;
      if (length > bestLength) {
        bestLength = length;
        bestStart = runStart;
      }
      runStart = -1;
    }
  }
  const text = groups.map((group) => group.toString(16));
  if (bestLength < 2) return text.join(':');
  const head = text.slice(0, bestStart).join(':');
  const tail = text.slice(bestStart + bestLength).join(':');
  return `${head}::${tail}`;
}

/**
 * 802.15.4 bağlantı adresinden IID türetir (RFC 6282 §3.2.2).
 * Uzatılmış adres: tel LE → kanonik EUI-64 (ters) → **U/L biti çevrilir**.
 * Kısa adres: `0000:00ff:fe00:XXXX` (RFC 6282 SAM/DAM tabloları, birebir).
 */
export function deriveIid(link: Uint8Array): Uint8Array | undefined {
  if (link.length === 8) {
    const iid = Uint8Array.from(Array.from(link).reverse());
    iid[0] = (iid[0] ?? 0) ^ 0x02;
    return iid;
  }
  if (link.length === 2) {
    // Tel LE; kısa adres ekranda ve IID'de BE yazılır.
    return Uint8Array.from([0, 0, 0, 0xff, 0xfe, 0, byteAt(link, 1), byteAt(link, 0)]);
  }
  return undefined;
}

const LINK_LOCAL_PREFIX = Uint8Array.from([0xfe, 0x80, 0, 0, 0, 0, 0, 0]);

function withLinkLocalPrefix(iid: Uint8Array): Uint8Array {
  const address = new Uint8Array(16);
  address.set(LINK_LOCAL_PREFIX, 0);
  address.set(iid, 8);
  return address;
}

// ── IPHC adres kipleri ────────────────────────────────────────────────────

/** SAC = 0 / (M = 0, DAC = 0) satır içi bayt sayısı; `11` ⇒ 0 (tamamen elenmiş). */
function statelessAddressInlineLength(mode: number): number {
  if (mode === 0) return 16;
  if (mode === 1) return 8;
  if (mode === 2) return 2;
  return 0;
}

/** M = 1, DAC = 0 çoklu yayın satır içi bayt sayısı (128 / 48 / 32 / 8 bit). */
function multicastInlineLength(mode: number): number {
  if (mode === 0) return 16;
  if (mode === 1) return 6;
  if (mode === 2) return 4;
  return 1;
}

/** M = 1, DAC = 0 kipleri için adresi RFC 6282'nin verdiği kalıplardan kurar. */
function buildMulticastAddress(mode: number, inline: Uint8Array): Uint8Array | undefined {
  const address = new Uint8Array(16);
  if (mode === 0) {
    address.set(inline.subarray(0, 16), 0);
    return address;
  }
  if (mode === 1) {
    // ffXX::00XX:XXXX:XXXX
    address[0] = 0xff;
    address[1] = byteAt(inline, 0);
    address[11] = byteAt(inline, 1);
    address.set(inline.subarray(2, 6), 12);
    return address;
  }
  if (mode === 2) {
    // ffXX::00XX:XXXX
    address[0] = 0xff;
    address[1] = byteAt(inline, 0);
    address[13] = byteAt(inline, 1);
    address.set(inline.subarray(2, 4), 14);
    return address;
  }
  // ff02::00XX
  address[0] = 0xff;
  address[1] = 0x02;
  address[15] = byteAt(inline, 0);
  return address;
}

/**
 * SAC = 0 / (M = 0, DAC = 0) kipleri için adresi kurar.
 * `11` ⇒ bağlantı adresinden türetilir (`link`), yoksa `undefined`.
 */
function buildStatelessAddress(
  mode: number,
  inline: Uint8Array,
  link: Uint8Array | undefined,
): { address: Uint8Array; derived: boolean } | undefined {
  if (mode === 0) {
    const address = new Uint8Array(16);
    address.set(inline.subarray(0, 16), 0);
    return { address, derived: false };
  }
  if (mode === 1) return { address: withLinkLocalPrefix(inline.subarray(0, 8)), derived: false };
  if (mode === 2) {
    const iid = Uint8Array.from([0, 0, 0, 0xff, 0xfe, 0, byteAt(inline, 0), byteAt(inline, 1)]);
    return { address: withLinkLocalPrefix(iid), derived: false };
  }
  if (link === undefined) return undefined;
  const iid = deriveIid(link);
  if (iid === undefined) return undefined;
  return { address: withLinkLocalPrefix(iid), derived: true };
}

// ── TF alanı ──────────────────────────────────────────────────────────────

/** RFC 6282 §3.1: 00 → 4 B · 01 → 3 B · 10 → 1 B · 11 → 0 B. */
function trafficFlowLength(tf: number): number {
  if (tf === 0) return 4;
  if (tf === 1) return 3;
  if (tf === 2) return 1;
  return 0;
}

// ── Yardımcılar ───────────────────────────────────────────────────────────

interface Sink {
  readonly data: Uint8Array;
  readonly fields: ParsedField[];
  readonly warnings: ProtocolWarning[];
  readonly errors: ProtocolError[];
  readonly messages: LowpanMessages;
}

function push(sink: Sink, field: ParsedField): void {
  sink.fields.push(field);
}

function warn(sink: Sink, key: string, offset: number, length: number): void {
  sink.warnings.push({ code: key, message: key, offset, length });
}

function bitField(
  sink: Sink,
  id: string,
  name: string,
  offset: number,
  byteLength: number,
  value: number,
  physicalValue?: string,
): void {
  const field: ParsedField = {
    id,
    name,
    offset,
    length: byteLength,
    rawBytes: sink.data.slice(offset, offset + byteLength),
    rawValue: value,
    valid: true,
    warnings: [],
  };
  if (physicalValue !== undefined) field.physicalValue = physicalValue;
  push(sink, field);
}

// ── Ana zincir ────────────────────────────────────────────────────────────

/**
 * 6LoWPAN dispatch zincirini `start`tan `end`e kadar çözer.
 *
 * `linkSource`/`linkDestination` 802.15.4 MAC adreslerinin HAM tel baytlarıdır
 * ve yalnız SAM/DAM = `11` (tamamen elenmiş adres) dalında kullanılır.
 */
export function decodeLowpan(
  data: Uint8Array,
  start: number,
  end: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: LowpanOptions,
  messages: LowpanMessages,
  linkSource: Uint8Array | undefined,
  linkDestination: Uint8Array | undefined,
): LowpanSummary {
  const sink: Sink = { data, fields, warnings, errors, messages };
  const headers: string[] = [];
  let cursor = start;
  let outOfScope: string | undefined;
  let fragment: LowpanFragment | undefined;
  let udp: LowpanUdp | undefined;

  const truncate = (offset: number): LowpanSummary => {
    errors.push({
      code: 'truncated-frame',
      message: messages.truncated,
      offset,
      length: Math.max(0, end - offset),
    });
    return {
      headers,
      outOfScope,
      fragment,
      udp,
      cursor: offset,
      payloadStart: offset,
      payloadEnd: end,
    };
  };

  const rfc4944Profile = options.dispatchProfile === DISPATCH_PROFILE_RFC4944;

  // ── Dispatch yığını: Mesh → BC0 → Fragment → IPHC/IPv6 ──────────────────
  let terminal = false;
  while (!terminal) {
    if (cursor >= end) return truncate(cursor);
    const dispatch = byteAt(data, cursor);

    if ((dispatch & 0xc0) === 0x00) {
      // NALP — 6LoWPAN çerçevesi DEĞİL. Zigbee NWK Frame Control baytı da
      // yapısal olarak bu aralığa düşer; `canParse`ın iki kaydı ayıran
      // ayırıcısı tam olarak budur.
      bitField(sink, 'lowpan-nalp-dispatch', '6LoWPAN Dispatch', cursor, 1, dispatch, 'NALP');
      warn(sink, messages.nalp, cursor, 1);
      outOfScope = 'NALP';
      headers.push('NALP');
      return { headers, outOfScope, fragment, udp, cursor, payloadStart: cursor, payloadEnd: end };
    }

    if ((dispatch & 0xc0) === 0x80) {
      // ── Mesh Addressing Header (RFC 4944 §5.2) ──────────────────────────
      headers.push('MESH');
      bitField(sink, 'lowpan-mesh-dispatch', '6LoWPAN Dispatch', cursor, 1, dispatch, 'MESH');
      const v = (dispatch >> 5) & 1;
      const f = (dispatch >> 4) & 1;
      const hopsLeft = dispatch & 0x0f;
      bitField(sink, 'lowpan-mesh-v', 'Mesh · V (Originator is 16-bit)', cursor, 1, v);
      bitField(sink, 'lowpan-mesh-f', 'Mesh · F (Final Destination is 16-bit)', cursor, 1, f);
      const hopsField: ParsedField = {
        id: 'lowpan-mesh-hops-left',
        name: 'Mesh · Hops Left',
        offset: cursor,
        length: 1,
        rawBytes: data.slice(cursor, cursor + 1),
        rawValue: hopsLeft,
        valid: true,
        warnings: [],
      };
      push(sink, hopsField);
      cursor += 1;
      if (hopsLeft === 0x0f) {
        // 🚨 KOŞULLU OFSET: `0xF` ⇒ hemen ardından 8 bitlik Deep Hops Left
        // (RFC 4944 §5.2). Atlanırsa adresler bir bayt kayar, HATA VERMEDEN.
        if (cursor >= end) return truncate(cursor);
        bitField(
          sink,
          'lowpan-mesh-deep-hops-left',
          'Mesh · Deep Hops Left',
          cursor,
          1,
          byteAt(data, cursor),
        );
        cursor += 1;
      }
      const originatorLength = v === 1 ? 2 : 8;
      const finalLength = f === 1 ? 2 : 8;
      if (cursor + originatorLength + finalLength > end) return truncate(cursor);
      push(sink, {
        id: 'lowpan-mesh-originator',
        name: 'Mesh · Originator Address',
        offset: cursor,
        length: originatorLength,
        rawBytes: data.slice(cursor, cursor + originatorLength),
        rawValue: formatLinkAddress(
          data.slice(cursor, cursor + originatorLength),
          options.addressDisplay,
        ),
        valid: true,
        warnings: [],
      });
      cursor += originatorLength;
      push(sink, {
        id: 'lowpan-mesh-final-destination',
        name: 'Mesh · Final Destination Address',
        offset: cursor,
        length: finalLength,
        rawBytes: data.slice(cursor, cursor + finalLength),
        rawValue: formatLinkAddress(data.slice(cursor, cursor + finalLength), options.addressDisplay),
        valid: true,
        warnings: [],
      });
      cursor += finalLength;
      continue;
    }

    if (dispatch === DISPATCH_BC0) {
      headers.push('LOWPAN_BC0');
      bitField(sink, 'lowpan-bc0-dispatch', '6LoWPAN Dispatch', cursor, 1, dispatch, 'LOWPAN_BC0');
      cursor += 1;
      if (cursor >= end) return truncate(cursor);
      bitField(sink, 'lowpan-bc0-sequence', 'LOWPAN_BC0 · Sequence Number', cursor, 1, byteAt(data, cursor));
      cursor += 1;
      continue;
    }

    if ((dispatch & 0xf8) === 0xc0 || (dispatch & 0xf8) === 0xe0) {
      // ── FRAG1 / FRAGN (RFC 4944 §5.3) ───────────────────────────────────
      const first = (dispatch & 0xf8) === 0xc0;
      const headerLength = first ? 4 : 5;
      headers.push(first ? 'FRAG1' : 'FRAGN');
      bitField(
        sink,
        'lowpan-frag-dispatch',
        '6LoWPAN Dispatch',
        cursor,
        1,
        dispatch,
        first ? 'FRAG1' : 'FRAGN',
      );
      if (cursor + headerLength > end) return truncate(cursor);
      const datagramSize = ((dispatch & 0x07) << 8) | byteAt(data, cursor + 1);
      const datagramTag = readUint16Be(data, cursor + 2);
      push(sink, {
        id: 'lowpan-frag-datagram-size',
        name: 'Fragment · Datagram Size',
        offset: cursor,
        length: 2,
        rawBytes: data.slice(cursor, cursor + 2),
        rawValue: datagramSize,
        unit: 'B',
        valid: true,
        warnings: [],
      });
      push(sink, {
        id: 'lowpan-frag-datagram-tag',
        name: 'Fragment · Datagram Tag',
        offset: cursor + 2,
        length: 2,
        rawBytes: data.slice(cursor + 2, cursor + 4),
        rawValue: toHex(datagramTag, 2),
        physicalValue: datagramTag,
        valid: true,
        warnings: [],
      });
      let datagramOffset = 0;
      if (!first) {
        // `datagram_offset` 8 OKTET KATLARIDIR — çarpılmazsa parça sırası
        // sekiz kat sıkışır, HATA VERMEDEN.
        const raw = byteAt(data, cursor + 4);
        datagramOffset = raw * 8;
        push(sink, {
          id: 'lowpan-frag-datagram-offset',
          name: 'Fragment · Datagram Offset',
          offset: cursor + 4,
          length: 1,
          rawBytes: data.slice(cursor + 4, cursor + 5),
          rawValue: raw,
          physicalValue: datagramOffset,
          unit: 'B',
          valid: true,
          warnings: [],
        });
      }
      cursor += headerLength;
      fragment = { datagramSize, datagramTag, datagramOffset, first };
      const fragmentPayload = Math.max(0, end - cursor);
      push(sink, {
        id: 'lowpan-frag-position',
        name: 'Fragment · Position in Datagram',
        offset: cursor,
        length: fragmentPayload,
        rawBytes: data.slice(cursor, end),
        rawValue: `${String(datagramOffset)}..${String(datagramOffset + fragmentPayload)} / ${String(datagramSize)}`,
        valid: true,
        warnings: [messages.fragmentNotReassembled],
      });
      warn(sink, messages.fragmentNotReassembled, cursor, fragmentPayload);
      if (first) continue;
      // FRAGN'in yükü bir datagram PARÇASIDIR; başlık taşımaz, zincir durur.
      return { headers, outOfScope, fragment, udp, cursor, payloadStart: cursor, payloadEnd: end };
    }

    if (dispatch === DISPATCH_IPV6) {
      headers.push('IPv6');
      bitField(sink, 'lowpan-ipv6-dispatch', '6LoWPAN Dispatch', cursor, 1, dispatch, 'IPv6');
      cursor += 1;
      if (cursor + IPV6_HEADER_LENGTH > end) return truncate(cursor);
      const versionTcFl =
        ((byteAt(data, cursor) << 24) |
          (byteAt(data, cursor + 1) << 16) |
          (byteAt(data, cursor + 2) << 8) |
          byteAt(data, cursor + 3)) >>>
        0;
      bitField(sink, 'ipv6-version', 'IPv6 · Version', cursor, 1, (versionTcFl >>> 28) & 0x0f);
      bitField(sink, 'ipv6-traffic-class', 'IPv6 · Traffic Class', cursor, 2, (versionTcFl >>> 20) & 0xff);
      bitField(sink, 'ipv6-flow-label', 'IPv6 · Flow Label', cursor + 1, 3, versionTcFl & 0xfffff);
      const payloadLength = readUint16Be(data, cursor + 4);
      push(sink, {
        id: 'ipv6-payload-length',
        name: 'IPv6 · Payload Length',
        offset: cursor + 4,
        length: 2,
        rawBytes: data.slice(cursor + 4, cursor + 6),
        rawValue: payloadLength,
        unit: 'B',
        valid: true,
        warnings: [],
      });
      const nextHeader = byteAt(data, cursor + 6);
      bitField(sink, 'ipv6-next-header', 'IPv6 · Next Header', cursor + 6, 1, nextHeader, IP_PROTOCOL_NAMES.get(nextHeader));
      bitField(sink, 'ipv6-hop-limit', 'IPv6 · Hop Limit', cursor + 7, 1, byteAt(data, cursor + 7));
      push(sink, {
        id: 'ipv6-source',
        name: 'IPv6 · Source Address',
        offset: cursor + 8,
        length: 16,
        rawBytes: data.slice(cursor + 8, cursor + 24),
        rawValue: formatIpv6(data.slice(cursor + 8, cursor + 24)),
        valid: true,
        warnings: [],
      });
      push(sink, {
        id: 'ipv6-destination',
        name: 'IPv6 · Destination Address',
        offset: cursor + 24,
        length: 16,
        rawBytes: data.slice(cursor + 24, cursor + 40),
        rawValue: formatIpv6(data.slice(cursor + 24, cursor + 40)),
        valid: true,
        warnings: [],
      });
      cursor += IPV6_HEADER_LENGTH;
      if (nextHeader === IP_PROTOCOL_UDP) {
        udp = decodePlainUdp(sink, cursor, end);
        cursor = udp === undefined ? cursor : udp.payloadStart;
      }
      terminal = true;
      break;
    }

    if (dispatch === DISPATCH_HC1) {
      headers.push('LOWPAN_HC1');
      const field: ParsedField = {
        id: 'lowpan-hc1-dispatch',
        name: '6LoWPAN Dispatch',
        offset: cursor,
        length: 1,
        rawBytes: data.slice(cursor, cursor + 1),
        rawValue: dispatch,
        physicalValue: 'LOWPAN_HC1',
        // `thread` profilinde kapsam DIŞI (`valid: false`); `rfc4944-full`
        // profilinde MEŞRU bir başlık türü, yalnız ÇÖZÜLMÜYOR.
        valid: rfc4944Profile,
        warnings: [messages.hc1OutOfScope],
      };
      push(sink, field);
      warn(sink, messages.hc1OutOfScope, cursor, 1);
      outOfScope = 'LOWPAN_HC1';
      return { headers, outOfScope, fragment, udp, cursor, payloadStart: cursor, payloadEnd: end };
    }

    if (dispatch === DISPATCH_ESC_6282 || (rfc4944Profile && dispatch === DISPATCH_ESC_4944)) {
      headers.push('ESC');
      bitField(sink, 'lowpan-esc-dispatch', '6LoWPAN Dispatch', cursor, 1, dispatch, 'ESC');
      cursor += 1;
      if (rfc4944Profile) {
        // RFC 4944 §5.1: *"Additional Dispatch byte follows"* — kanal
        // çıktıyı BAYT DÜZEYİNDE değiştiriyor, bu yüzden gerçek bir kanal.
        if (cursor >= end) return truncate(cursor);
        bitField(sink, 'lowpan-esc-extension', 'ESC · Additional Dispatch', cursor, 1, byteAt(data, cursor));
        cursor += 1;
      }
      warn(sink, messages.escNotAllocated, cursor, 0);
      outOfScope = 'ESC';
      return { headers, outOfScope, fragment, udp, cursor, payloadStart: cursor, payloadEnd: end };
    }

    if (!rfc4944Profile && (dispatch & 0xe0) === 0x60) {
      headers.push('IPHC');
      const iphc = decodeIphc(sink, cursor, end, options, linkSource, linkDestination);
      if (iphc === undefined) return truncate(cursor);
      cursor = iphc.cursor;
      udp = iphc.udp;
      if (udp !== undefined) cursor = udp.payloadStart;
      terminal = true;
      break;
    }

    // Tanınmayan dispatch — UYDURULMAZ.
    push(sink, {
      id: 'lowpan-unknown-dispatch',
      name: '6LoWPAN Dispatch',
      offset: cursor,
      length: 1,
      rawBytes: data.slice(cursor, cursor + 1),
      rawValue: toHex(dispatch, 1),
      valid: false,
      warnings: [messages.unknownDispatch],
    });
    warn(sink, messages.unknownDispatch, cursor, 1);
    outOfScope = 'unknown';
    return { headers, outOfScope, fragment, udp, cursor, payloadStart: cursor, payloadEnd: end };
  }

  return {
    headers,
    outOfScope,
    fragment,
    udp,
    cursor,
    payloadStart: udp?.payloadStart ?? cursor,
    payloadEnd: udp?.payloadEnd ?? end,
  };
}

// ── IP protokol adları — DAR ve kaynağı belli (IANA) ──────────────────────

export const IP_PROTOCOL_UDP = 17;

/**
 * Yalnız bu dalganın zincirinde geçebilen numaralar. Tam IANA tablosu bir
 * protokol motorunun işi değildir; bilinmeyen numara HATA DEĞİLDİR, adsız
 * kalır (`bleAdvertisement.ts`in bilinmeyen Company ID emsali).
 */
export const IP_PROTOCOL_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'IPv6 Hop-by-Hop Option'],
  [6, 'TCP'],
  [IP_PROTOCOL_UDP, 'UDP'],
  [58, 'ICMPv6'],
]);

// ── Sıkıştırılmamış UDP ───────────────────────────────────────────────────

function decodePlainUdp(sink: Sink, start: number, end: number): LowpanUdp | undefined {
  if (start + UDP_HEADER_LENGTH > end) {
    sink.errors.push({
      code: 'truncated-frame',
      message: sink.messages.truncated,
      offset: start,
      length: Math.max(0, end - start),
    });
    return undefined;
  }
  const sourcePort = readUint16Be(sink.data, start);
  const destinationPort = readUint16Be(sink.data, start + 2);
  const length = readUint16Be(sink.data, start + 4);
  bitField(sink, 'udp-source-port', 'UDP · Source Port', start, 2, sourcePort);
  bitField(sink, 'udp-destination-port', 'UDP · Destination Port', start + 2, 2, destinationPort);
  push(sink, {
    id: 'udp-length',
    name: 'UDP · Length',
    offset: start + 4,
    length: 2,
    rawBytes: sink.data.slice(start + 4, start + 6),
    rawValue: length,
    unit: 'B',
    valid: true,
    warnings: [],
  });
  push(sink, {
    id: 'udp-checksum',
    name: 'UDP · Checksum',
    offset: start + 6,
    length: 2,
    rawBytes: sink.data.slice(start + 6, start + 8),
    rawValue: toHex(readUint16Be(sink.data, start + 6), 2),
    // DOĞRULANMAZ — kapsam IPv6 sözde başlığıdır (dosya başı).
    valid: true,
    warnings: [sink.messages.udpChecksumNotVerified],
  });
  const payloadStart = start + UDP_HEADER_LENGTH;
  // UDP Length telde VAR; yükün sonu ondan TÜRETİLİR ama çerçevenin sonunu
  // AŞAMAZ (bozuk uzunluk alanı yükü çerçeve dışına taşırırdı).
  const declaredEnd = start + Math.max(UDP_HEADER_LENGTH, length);
  return { sourcePort, destinationPort, payloadStart, payloadEnd: Math.min(end, declaredEnd) };
}

// ── LOWPAN_IPHC (RFC 6282 §3.1) ───────────────────────────────────────────

interface IphcResult {
  readonly cursor: number;
  readonly udp: LowpanUdp | undefined;
}

function decodeIphc(
  sink: Sink,
  start: number,
  end: number,
  options: LowpanOptions,
  linkSource: Uint8Array | undefined,
  linkDestination: Uint8Array | undefined,
): IphcResult | undefined {
  const data = sink.data;
  if (start + 2 > end) return undefined;
  const b0 = byteAt(data, start);
  const b1 = byteAt(data, start + 1);

  const tf = (b0 >> 3) & 0x03;
  const nh = (b0 >> 2) & 0x01;
  const hlim = b0 & 0x03;
  const cid = (b1 >> 7) & 0x01;
  const sac = (b1 >> 6) & 0x01;
  const sam = (b1 >> 4) & 0x03;
  const m = (b1 >> 3) & 0x01;
  const dac = (b1 >> 2) & 0x01;
  const dam = b1 & 0x03;

  bitField(sink, 'iphc-dispatch', '6LoWPAN Dispatch', start, 1, b0, 'LOWPAN_IPHC');
  bitField(sink, 'iphc-tf', 'IPHC · TF (Traffic Class / Flow Label)', start, 1, tf, TF_NAMES.get(tf));
  bitField(sink, 'iphc-nh', 'IPHC · NH (Next Header compressed)', start, 1, nh);
  bitField(sink, 'iphc-hlim', 'IPHC · HLIM (Hop Limit)', start, 1, hlim, HLIM_NAMES.get(hlim));
  bitField(sink, 'iphc-cid', 'IPHC · CID (Context Identifier Extension)', start + 1, 1, cid);
  bitField(sink, 'iphc-sac', 'IPHC · SAC (Source Address Compression)', start + 1, 1, sac);
  bitField(sink, 'iphc-sam', 'IPHC · SAM (Source Address Mode)', start + 1, 1, sam);
  bitField(sink, 'iphc-m', 'IPHC · M (Multicast)', start + 1, 1, m);
  bitField(sink, 'iphc-dac', 'IPHC · DAC (Destination Address Compression)', start + 1, 1, dac);
  bitField(sink, 'iphc-dam', 'IPHC · DAM (Destination Address Mode)', start + 1, 1, dam);

  let cursor = start + 2;

  if (cid === 1) {
    if (cursor + 1 > end) return undefined;
    const contexts = byteAt(data, cursor);
    bitField(sink, 'iphc-source-context', 'IPHC · Source Context Identifier', cursor, 1, (contexts >> 4) & 0x0f);
    bitField(sink, 'iphc-destination-context', 'IPHC · Destination Context Identifier', cursor, 1, contexts & 0x0f);
    cursor += 1;
  }

  const tfLength = trafficFlowLength(tf);
  if (tfLength > 0) {
    if (cursor + tfLength > end) return undefined;
    push(sink, {
      id: 'iphc-traffic-flow',
      name: 'IPHC · Traffic Class / Flow Label',
      offset: cursor,
      length: tfLength,
      rawBytes: data.slice(cursor, cursor + tfLength),
      rawValue: hexBytes(data.slice(cursor, cursor + tfLength)),
      valid: true,
      warnings: [],
    });
    cursor += tfLength;
  }

  let nextHeader: number | undefined;
  if (nh === 0) {
    if (cursor + 1 > end) return undefined;
    nextHeader = byteAt(data, cursor);
    bitField(sink, 'iphc-next-header', 'IPHC · Next Header', cursor, 1, nextHeader, IP_PROTOCOL_NAMES.get(nextHeader));
    cursor += 1;
  }

  if (hlim === 0) {
    if (cursor + 1 > end) return undefined;
    bitField(sink, 'iphc-hop-limit', 'IPHC · Hop Limit', cursor, 1, byteAt(data, cursor));
    cursor += 1;
  }

  // ── Kaynak adres ────────────────────────────────────────────────────────
  const sourceInline = sac === 1 && sam === 0 ? 0 : statelessAddressInlineLength(sam);
  if (cursor + sourceInline > end) return undefined;
  const sourceBytes = data.slice(cursor, cursor + sourceInline);
  const sourceField: ParsedField = {
    id: 'iphc-source-address',
    name: 'IPHC · Source Address',
    offset: cursor,
    length: sourceInline,
    rawBytes: sourceBytes,
    valid: true,
    warnings: [],
  };
  if (sac === 1) {
    if (sam === 0) {
      sourceField.rawValue = '::';
      sourceField.physicalValue = '::';
    } else {
      // Bağlam tablosu TELDE YOK — adres KURULMAZ (dosya başı).
      sourceField.rawValue = hexBytes(sourceBytes);
      sourceField.warnings = [sink.messages.contextNotOnWire];
      warn(sink, sink.messages.contextNotOnWire, cursor, sourceInline);
    }
  } else {
    const built = buildStatelessAddress(sam, sourceBytes, linkSource);
    if (built === undefined) {
      sourceField.rawValue = hexBytes(sourceBytes);
      sourceField.warnings = [sink.messages.iidDerived];
    } else {
      sourceField.rawValue = formatIpv6(built.address);
      if (built.derived) {
        sourceField.warnings = [sink.messages.iidDerived];
        warn(sink, sink.messages.iidDerived, cursor, sourceInline);
      }
    }
  }
  push(sink, sourceField);
  cursor += sourceInline;

  // ── Hedef adres ─────────────────────────────────────────────────────────
  let destinationInline: number;
  let reservedDam = false;
  if (m === 1) {
    if (dac === 1) {
      // M = 1, DAC = 1: yalnız `00` (unicast-prefix-based, 48 bit) tanımlı.
      destinationInline = dam === 0 ? 6 : 0;
      reservedDam = dam !== 0;
    } else {
      destinationInline = multicastInlineLength(dam);
    }
  } else if (dac === 1) {
    // M = 0, DAC = 1: `00` REZERVE.
    destinationInline = dam === 0 ? 0 : statelessAddressInlineLength(dam);
    reservedDam = dam === 0;
  } else {
    destinationInline = statelessAddressInlineLength(dam);
  }
  if (cursor + destinationInline > end) return undefined;
  const destinationBytes = data.slice(cursor, cursor + destinationInline);
  const destinationField: ParsedField = {
    id: 'iphc-destination-address',
    name: 'IPHC · Destination Address',
    offset: cursor,
    length: destinationInline,
    rawBytes: destinationBytes,
    valid: !reservedDam,
    warnings: [],
  };
  if (reservedDam) {
    destinationField.rawValue = hexBytes(destinationBytes);
    destinationField.warnings = [sink.messages.reservedAddressMode];
    warn(sink, sink.messages.reservedAddressMode, cursor, destinationInline);
  } else if (m === 1 && dac === 0) {
    const built = buildMulticastAddress(dam, destinationBytes);
    destinationField.rawValue =
      built === undefined ? hexBytes(destinationBytes) : formatIpv6(built);
  } else if (dac === 1) {
    destinationField.rawValue = hexBytes(destinationBytes);
    destinationField.warnings = [sink.messages.contextNotOnWire];
    warn(sink, sink.messages.contextNotOnWire, cursor, destinationInline);
  } else {
    const built = buildStatelessAddress(dam, destinationBytes, linkDestination);
    if (built === undefined) {
      destinationField.rawValue = hexBytes(destinationBytes);
      destinationField.warnings = [sink.messages.iidDerived];
    } else {
      destinationField.rawValue = formatIpv6(built.address);
      if (built.derived) {
        destinationField.warnings = [sink.messages.iidDerived];
        warn(sink, sink.messages.iidDerived, cursor, destinationInline);
      }
    }
  }
  push(sink, destinationField);
  cursor += destinationInline;

  // ── Sıkıştırma kazancı — katalogun "Compression Saving" aracı ───────────
  const compressedLength = cursor - start;
  push(sink, {
    id: 'iphc-compression-saving',
    name: 'IPHC · Compression Saving',
    offset: start,
    length: compressedLength,
    rawBytes: data.slice(start, cursor),
    rawValue: compressedLength,
    physicalValue: IPV6_HEADER_LENGTH - compressedLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  // ── Sonraki başlık ──────────────────────────────────────────────────────
  let udp: LowpanUdp | undefined;
  if (nh === 0) {
    if (nextHeader === IP_PROTOCOL_UDP) udp = decodePlainUdp(sink, cursor, end);
  } else {
    const nhc = decodeNhc(sink, cursor, end, options);
    if (nhc !== undefined) {
      udp = nhc.udp;
      cursor = nhc.cursor;
    }
  }

  return { cursor: udp?.payloadStart ?? cursor, udp };
}

const TF_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'ECN + DSCP + 4-bit Pad + Flow Label (4 B)'],
  [1, 'ECN + 2-bit Pad + Flow Label (3 B)'],
  [2, 'ECN + DSCP (1 B)'],
  [3, 'elided'],
]);

const HLIM_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'in-line'],
  [1, '1'],
  [2, '64'],
  [3, '255'],
]);

// ── LOWPAN_NHC (RFC 6282 §4) ──────────────────────────────────────────────

interface NhcResult {
  readonly cursor: number;
  readonly udp: LowpanUdp | undefined;
}

function decodeNhc(
  sink: Sink,
  start: number,
  end: number,
  options: LowpanOptions,
): NhcResult | undefined {
  const data = sink.data;
  if (start + 1 > end) return undefined;
  const nhc = byteAt(data, start);

  if ((nhc & 0xf8) !== 0xf0) {
    // NHC var ama UDP DEĞİL (genişletme başlıkları `1110 xxxx`) — kapsam dışı.
    push(sink, {
      id: 'nhc-dispatch',
      name: 'LOWPAN_NHC',
      offset: start,
      length: 1,
      rawBytes: data.slice(start, start + 1),
      rawValue: toHex(nhc, 1),
      valid: true,
      warnings: [sink.messages.nhcNotUdp],
    });
    sink.warnings.push({ code: sink.messages.nhcNotUdp, message: sink.messages.nhcNotUdp, offset: start, length: 1 });
    return { cursor: start + 1, udp: undefined };
  }

  const checksumElidedOnWire = ((nhc >> 2) & 1) === 1;
  const ports = nhc & 0x03;
  bitField(sink, 'nhc-udp-dispatch', 'LOWPAN_NHC · UDP', start, 1, nhc, 'NHC UDP');
  bitField(sink, 'nhc-udp-checksum-elided', 'NHC UDP · C (Checksum elided)', start, 1, checksumElidedOnWire ? 1 : 0);
  bitField(sink, 'nhc-udp-ports', 'NHC UDP · P (Port compression)', start, 1, ports, NHC_PORT_NAMES.get(ports));

  let cursor = start + 1;
  let sourcePort = 0;
  let destinationPort = 0;
  const portBytes = ports === 0 ? 4 : ports === 3 ? 1 : 3;
  if (cursor + portBytes > end) return undefined;

  if (ports === 0) {
    sourcePort = readUint16Be(data, cursor);
    destinationPort = readUint16Be(data, cursor + 2);
    bitField(sink, 'udp-source-port', 'UDP · Source Port', cursor, 2, sourcePort);
    bitField(sink, 'udp-destination-port', 'UDP · Destination Port', cursor + 2, 2, destinationPort);
  } else if (ports === 1) {
    sourcePort = readUint16Be(data, cursor);
    destinationPort = 0xf000 | byteAt(data, cursor + 2);
    bitField(sink, 'udp-source-port', 'UDP · Source Port', cursor, 2, sourcePort);
    bitField(sink, 'udp-destination-port', 'UDP · Destination Port', cursor + 2, 1, destinationPort);
  } else if (ports === 2) {
    sourcePort = 0xf000 | byteAt(data, cursor);
    destinationPort = readUint16Be(data, cursor + 1);
    bitField(sink, 'udp-source-port', 'UDP · Source Port', cursor, 1, sourcePort);
    bitField(sink, 'udp-destination-port', 'UDP · Destination Port', cursor + 1, 2, destinationPort);
  } else {
    const nibbles = byteAt(data, cursor);
    sourcePort = 0xf0b0 | ((nibbles >> 4) & 0x0f);
    destinationPort = 0xf0b0 | (nibbles & 0x0f);
    bitField(sink, 'udp-source-port', 'UDP · Source Port', cursor, 1, sourcePort);
    bitField(sink, 'udp-destination-port', 'UDP · Destination Port', cursor, 1, destinationPort);
  }
  cursor += portBytes;

  // `udpChecksumElided` kanalı: NHC'nin `C` biti telde VAR ama tescilli
  // dağıtımlar sapabiliyor ve karar yükün NEREDE başladığını iki bayt
  // kaydırıyor — bu yüzden kanal BAYT DÜZEYİNDE bir karardır.
  let checksumPresent = !checksumElidedOnWire;
  if (options.udpChecksumElided === UDP_CHECKSUM_PRESENT) checksumPresent = true;
  if (options.udpChecksumElided === UDP_CHECKSUM_ELIDED) checksumPresent = false;

  if (checksumPresent) {
    if (cursor + 2 > end) return undefined;
    push(sink, {
      id: 'udp-checksum',
      name: 'UDP · Checksum',
      offset: cursor,
      length: 2,
      rawBytes: data.slice(cursor, cursor + 2),
      rawValue: toHex(readUint16Be(data, cursor), 2),
      valid: true,
      warnings: [sink.messages.udpChecksumNotVerified],
    });
    cursor += 2;
  } else {
    // Checksum TELDE YOK ⇒ PASS/FAIL BASILMAZ (dalga 13 dersi 3).
    sink.warnings.push({
      code: sink.messages.udpChecksumElidedOnWire,
      message: sink.messages.udpChecksumElidedOnWire,
      offset: cursor,
      length: 0,
    });
  }

  // RFC 6282 §4.3.3: UDP Length TELDE HİÇ YOKTUR — alt katmandan çıkarılır.
  return { cursor, udp: { sourcePort, destinationPort, payloadStart: cursor, payloadEnd: end } };
}

const NHC_PORT_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'both 16-bit in-line'],
  [1, 'destination 8-bit (0xF0xx)'],
  [2, 'source 8-bit (0xF0xx)'],
  [3, 'both 4-bit (0xF0Bx)'],
]);
