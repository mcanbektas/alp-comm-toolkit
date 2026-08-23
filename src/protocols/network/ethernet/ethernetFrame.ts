/**
 * Ethernet II / IEEE 802.3 / VLAN 802.1Q — ORTAK çerçeve çözümü.
 *
 * TEK PARSER, ÜÇ PLUGIN (canClassic.ts'in iki-plugin-tek-parser emsali, brief
 * faz10-dalga4a): üç sayfanın da tel biçimi AYNIDIR — DST MAC(6) + SRC MAC(6) +
 * 2 baytlık alan (+ opsiyonel VLAN tag) + payload. Ayrım mekanik: 2 baytlık alan
 * ≥ 0x0600 ise EtherType (Ethernet II), ≤ 0x05DC ise Length (IEEE 802.3), tam
 * 0x8100 ise VLAN TCI'a geçilir. 1501-1535 (0x05DD-0x05FF) tanımsız aralık —
 * spec bunun HATA değil UYARI olduğunu ve çözümlemenin sürmesi gerektiğini şart
 * koşuyor (docs/spec/ozet/08-ag-ethernet.md "IEEE 802.3" bölümü; ana spec
 * 25547-25601).
 *
 * KATMAN ZİNCİRİ İSTİSNASI (karar 1, brief-faz10-dalga4.md): motor zincir
 * KURMAZ. EtherType IPv4/ARP/IPv6'yı ADLANDIRIR, payload'ı ÇÖZMEZ — "şu
 * sayfada çöz" uyarısı CAN'ın `suggestHigherLayers` tonunun emsalidir.
 *
 * FCS (karar 3, seçenek a): FCS'in var olduğu HİÇ varsayılmaz — son 4 bayt
 * her zaman payload'ın parçası olarak kalır (çoğu capture FCS'i zaten
 * kaldırıyor, spec 25462-25497). "FCS not captured" bilgi alanı her zaman
 * basılır; son 4 bayt CRC-32 (Ethernet FCS algoritması, `crcCatalogue.ts`
 * `CRC32` girdisi) ile fırsatçı eşleşirse SADECE bilgi notu eklenir — 2⁻³²
 * ihtimalle yanlış pozitif riski olduğu için ASLA PASS/FAIL iddiası basılmaz.
 */

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import type { ParsedField, ProtocolError } from '@/protocol-core/types';

export const MAC_LENGTH = 6;
/** DST/SRC MAC'ten sonraki tip/uzunluk alanının genişliği — 5d (EtherCAT) bu
 * alanın ofsetini kendi çerçevesinde hesaplarken de kullanır. */
export const TYPE_LENGTH_FIELD_LENGTH = 2;
const TCI_LENGTH = 2;
const TAG_LENGTH = TYPE_LENGTH_FIELD_LENGTH + TCI_LENGTH;
/** DST(6) + SRC(6) + tip/uzunluk alanı(2) — VLAN tag'siz asgari başlık. */
export const MIN_HEADER_LENGTH = MAC_LENGTH * 2 + TYPE_LENGTH_FIELD_LENGTH;

/** `canParse` ön elemesi için de kullanılır (ethernet.ts) — üç sayfanın hangi
 * değer aralığını "kendine ait" saydığı burada sabitlenir. */
export const ETHERTYPE_MIN = 0x0600;
export const LENGTH_MAX = 0x05dc;
export const VLAN_TPID = 0x8100;
/** Spec "recursive" der (25781) ama sınırsız derinlik sonsuz döngü riski taşır —
 * 3 seviye (çift/üçlü tag) pratikte yeterli, ötesi uyarıyla durdurulur. */
const MAX_VLAN_TAGS = 3;
const FCS_LENGTH = 4;

const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;

export const ERROR_TYPE_LENGTH_TRUNCATED = 'protocol.ethernet.error.typeLengthTruncated';
export const ERROR_VLAN_TAG_TRUNCATED = 'protocol.ethernet.error.vlanTagTruncated';

export const WARN_ETHERTYPE_HIGHER_LAYER = 'protocol.ethernet.warning.etherTypeHigherLayer';
export const WARN_UNKNOWN_ETHERTYPE = 'protocol.ethernet.warning.unknownEtherType';
export const WARN_UNDEFINED_TYPE_LENGTH_RANGE = 'protocol.ethernet.warning.undefinedTypeLengthRange';
export const WARN_TOO_MANY_VLAN_TAGS = 'protocol.ethernet.warning.tooManyVlanTags';
export const WARN_FCS_OPPORTUNISTIC_MATCH = 'protocol.ethernet.warning.fcsOpportunisticMatch';
export const WARN_LOOKS_LIKE_ETHERNET_II = 'protocol.ethernet.warning.looksLikeEthernetII';
export const WARN_LOOKS_LIKE_IEEE_802_3 = 'protocol.ethernet.warning.looksLikeIeee8023';
export const WARN_LOOKS_LIKE_VLAN_TAGGED = 'protocol.ethernet.warning.looksLikeVlanTagged';

const SUMMARY_ETHERTYPE_FRAME = 'protocol.ethernet.summary.etherTypeFrame';
const SUMMARY_LENGTH_FRAME = 'protocol.ethernet.summary.lengthFrame';
const SUMMARY_VLAN_TAGGED_FRAME = 'protocol.ethernet.summary.vlanTaggedFrame';
const SUMMARY_UNDEFINED_RANGE_FRAME = 'protocol.ethernet.summary.undefinedRangeFrame';
const SUMMARY_TRUNCATED_FRAME = 'protocol.ethernet.summary.truncatedFrame';

/** Sayfanın kendisi — hangi yorumu BEKLEDİĞİ (page kimliği, uyarı üretmek için). */
export type EthernetPageKind = 'ethernet-ii' | 'ieee-802-3' | 'vlan-802-1q';

/** Bu depoda dar tutulan EtherType adlandırma kümesi (spec 25410-25416 + 28.1) —
 * yalnız spec'in doğrudan verdiği dört değerden ÜÇÜ burada isimlendirilir (0x8100
 * VLAN branch'inde ayrıca ele alınır, hiçbir zaman "final" EtherType olarak
 * buraya düşmez).
 *
 * 0x88A4 (EtherCAT) faz 10 dalga 5d'de, 0x88B8 (IEC 61850 GOOSE) 5e'de,
 * 0x8892 (PROFINET PN-RT) 13e'de eklendi:
 * bu depoda motoru OLAN her EtherType burada ADLANDIRILIR ki
 * `WARN_ETHERTYPE_HIGHER_LAYER` ("kendi sayfasında çöz") yönlendirmesi çalışsın
 * — zincir yine kurulmaz. */
const ETHER_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x0800, 'IPv4'],
  [0x0806, 'ARP'],
  [0x86dd, 'IPv6'],
  [0x8892, 'PROFINET'],
  [0x88a4, 'EtherCAT'],
  [0x88b8, 'GOOSE'],
]);

export type EthernetFrameMetadata = {
  destinationMac: string;
  sourceMac: string;
  vlanTagCount: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

export interface EthernetDecodeOptions {
  /** Bu çözüm hangi sayfadan istendi — yalnız "beklenenden farklı" uyarısını sürer. */
  readonly expectedKind: EthernetPageKind;
}

export interface EthernetDecodeResult {
  readonly fields: readonly ParsedField[];
  readonly warnings: readonly string[];
  readonly errors: readonly ProtocolError[];
  readonly metadata: EthernetFrameMetadata;
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

/**
 * MAC çiftinden sonraki 2 baytlık alanı UCUZCA okur — `canParse` ön elemesi
 * (spec §7: 172 parser'a sırayla soruluyor, kısa sabit maliyetli olmalı) bu
 * fonksiyonu kullanır, tam çözümü değil.
 */
export function peekTypeOrLengthField(data: Uint8Array): number | undefined {
  if (data.length < MIN_HEADER_LENGTH) return undefined;
  return readUint16BE(data, MAC_LENGTH * 2);
}

/** Dışa açık: EtherCAT/GOOSE gibi "çerçevenin KENDİSİ olan" protokoller de aynı
 * MAC biçimini basmalı — ikinci bir formatlayıcı iki farklı gösterim demektir. */
export function formatMac(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) =>
    byte.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_PER_BYTE, '0'),
  ).join(':');
}

/** Spec "Destination türü" (25378 civarı): Broadcast özel durumu, aksi hâlde
 * I/G bitine (ilk baytın LSB'i) bakılır. Yalnız DESTINATION için istenir. */
export function classifyDestinationMac(bytes: Uint8Array): string {
  const isBroadcast = bytes.length === MAC_LENGTH && bytes.every((byte) => byte === 0xff);
  if (isBroadcast) return 'Broadcast';
  return (byteAt(bytes, 0) & 0x01) === 1 ? 'Multicast' : 'Unicast';
}

/**
 * Ethernet FCS = CRC-32 (`crcCatalogue.ts` `CRC32`), telde LEAST-SIGNIFICANT-BYTE
 * ÖNCE taşınır (Ethernet bit sırasının doğal sonucu — yakalanmış bir çerçevede son
 * 4 bayt, little-endian okunduğunda hesaplanan CRC-32'ye eşitse gerçek FCS budur).
 * Bu fonksiyon yalnız fırsatçı bir EŞLEŞME arar, asla "doğrulandı" demez —
 * çağıran taraf bunu yalnız bilgi notuna çevirir (karar 3a, dosya başı).
 */
function matchesOpportunisticCrc(data: Uint8Array): boolean {
  const body = data.slice(0, data.length - FCS_LENGTH);
  const tail = data.slice(data.length - FCS_LENGTH);
  const computed = computeNamedCrc(body, 'CRC32');
  const tailValue =
    (byteAt(tail, 0) | (byteAt(tail, 1) << 8) | (byteAt(tail, 2) << 16) | (byteAt(tail, 3) << 24)) >>>
    0;
  return computed === BigInt(tailValue);
}

/** Her zaman eklenir: bilgi alanı, byte tüketmez (offset=uzunluk, length=0). */
function buildFcsField(data: Uint8Array, warnings: string[]): ParsedField {
  const opportunisticMatch =
    data.length >= MIN_HEADER_LENGTH + FCS_LENGTH && matchesOpportunisticCrc(data);
  const fieldWarnings: string[] = [];
  if (opportunisticMatch) {
    fieldWarnings.push(WARN_FCS_OPPORTUNISTIC_MATCH);
    warnings.push(WARN_FCS_OPPORTUNISTIC_MATCH);
  }
  return {
    id: 'fcs',
    name: 'FCS',
    offset: data.length,
    length: 0,
    rawBytes: new Uint8Array(0),
    physicalValue: 'FCS not captured',
    valid: true,
    warnings: fieldWarnings,
  };
}

export interface TypeLengthOutcome {
  readonly cursor: number;
  readonly finalValue: number | undefined;
  readonly vlanTagCount: number;
  readonly tooManyVlanTags: boolean;
}

/**
 * DST/SRC MAC'ten SONRAKİ 2 baytlık alanı çözer: EtherType / Length / tanımsız
 * aralık ayrımı ve VLAN TCI döngüsü burada yaşar. `fields`/`warnings`/`errors`
 * mutable out-param'dır (doip.ts'teki `decode*` fonksiyonlarının deseni).
 *
 * Dışa açık: EtherCAT (5d) Ethernet çerçevesinin KENDİSİNİ çözer ve VLAN'lı
 * varyantı da desteklemek zorunda — TPID/TCI yürüyüşünü ikinci kez yazmak iki
 * ayrı VLAN davranışı demek olurdu.
 */
export function walkTypeLengthChain(
  data: Uint8Array,
  cursor: number,
  fields: ParsedField[],
  warnings: string[],
  errors: ProtocolError[],
): TypeLengthOutcome {
  let position = cursor;
  let vlanTagCount = 0;

  while (true) {
    if (data.length - position < TYPE_LENGTH_FIELD_LENGTH) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_TYPE_LENGTH_TRUNCATED,
        offset: position,
        length: data.length - position,
      });
      return { cursor: position, finalValue: undefined, vlanTagCount, tooManyVlanTags: false };
    }

    const value = readUint16BE(data, position);
    if (value !== VLAN_TPID) {
      return { cursor: position + TYPE_LENGTH_FIELD_LENGTH, finalValue: value, vlanTagCount, tooManyVlanTags: false };
    }

    if (vlanTagCount >= MAX_VLAN_TAGS) {
      // Tag'i TÜKETME: sayaç aşıldı, kalan baytlar (bu TPID dahil) ham payload olur.
      warnings.push(WARN_TOO_MANY_VLAN_TAGS);
      return { cursor: position, finalValue: undefined, vlanTagCount, tooManyVlanTags: true };
    }

    if (data.length - position < TAG_LENGTH) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_VLAN_TAG_TRUNCATED,
        offset: position,
        length: data.length - position,
      });
      return { cursor: position, finalValue: undefined, vlanTagCount, tooManyVlanTags: false };
    }

    vlanTagCount += 1;
    const tagNumber = vlanTagCount;
    const tpidBytes = data.slice(position, position + TYPE_LENGTH_FIELD_LENGTH);
    fields.push({
      id: `vlan-${String(tagNumber)}-tpid`,
      name: `VLAN Tag #${String(tagNumber)} — TPID`,
      offset: position,
      length: TYPE_LENGTH_FIELD_LENGTH,
      rawBytes: tpidBytes,
      rawValue: value,
      physicalValue: 'IEEE 802.1Q',
      valid: true,
      warnings: [],
    });

    const tciOffset = position + TYPE_LENGTH_FIELD_LENGTH;
    const tci = readUint16BE(data, tciOffset);
    const pcp = (tci >>> 13) & 0x7;
    const dei = (tci >>> 12) & 0x1;
    const vid = tci & 0x0fff;
    const tciBytes = data.slice(tciOffset, tciOffset + TCI_LENGTH);

    fields.push({
      id: `vlan-${String(tagNumber)}-pcp`,
      name: `VLAN Tag #${String(tagNumber)} — PCP`,
      offset: tciOffset,
      length: TCI_LENGTH,
      rawBytes: tciBytes,
      rawValue: pcp,
      valid: true,
      warnings: [],
    });
    fields.push({
      id: `vlan-${String(tagNumber)}-dei`,
      name: `VLAN Tag #${String(tagNumber)} — DEI`,
      offset: tciOffset,
      length: TCI_LENGTH,
      rawBytes: tciBytes,
      rawValue: dei,
      valid: true,
      warnings: [],
    });
    fields.push({
      id: `vlan-${String(tagNumber)}-vid`,
      name: `VLAN Tag #${String(tagNumber)} — VLAN ID`,
      offset: tciOffset,
      length: TCI_LENGTH,
      rawBytes: tciBytes,
      rawValue: vid,
      valid: true,
      warnings: [],
    });

    position = tciOffset + TCI_LENGTH;
  }
}

/** Sayfa beklentisiyle gerçek yorum uyuşmuyorsa (CAN `suggestHigherLayers`
 * emsali) hangi sayfanın uyacağını söyleyen uyarı. */
function pushPageMismatchWarning(
  actualKind: EthernetPageKind | 'undefined-range',
  expectedKind: EthernetPageKind,
  warnings: string[],
): void {
  if (actualKind === 'undefined-range' || actualKind === expectedKind) return;
  const key =
    actualKind === 'ethernet-ii'
      ? WARN_LOOKS_LIKE_ETHERNET_II
      : actualKind === 'ieee-802-3'
        ? WARN_LOOKS_LIKE_IEEE_802_3
        : WARN_LOOKS_LIKE_VLAN_TAGGED;
  warnings.push(key);
}

/**
 * Ortak çözüm — `data` en az `MIN_HEADER_LENGTH` bayt olduğu ÖNCEDEN
 * doğrulanmış olmalıdır (çağıran `ethernet.ts`teki `parseEthernetFrame`).
 * Fırlatmaz: kısa/bozuk gövde uyarı+hataya çevrilir, kısmi alan listesi döner.
 */
export function decodeEthernetFrame(
  data: Uint8Array,
  options: EthernetDecodeOptions,
): EthernetDecodeResult {
  const fields: ParsedField[] = [];
  const warnings: string[] = [];
  const errors: ProtocolError[] = [];
  const summaryParams: Record<string, string> = {};

  const destinationBytes = data.slice(0, MAC_LENGTH);
  const destinationMac = formatMac(destinationBytes);
  fields.push({
    id: 'destination-mac',
    name: 'Destination MAC',
    offset: 0,
    length: MAC_LENGTH,
    rawBytes: destinationBytes,
    rawValue: destinationMac,
    physicalValue: classifyDestinationMac(destinationBytes),
    valid: true,
    warnings: [],
  });

  const sourceBytes = data.slice(MAC_LENGTH, MAC_LENGTH * 2);
  const sourceMac = formatMac(sourceBytes);
  fields.push({
    id: 'source-mac',
    name: 'Source MAC',
    offset: MAC_LENGTH,
    length: MAC_LENGTH,
    rawBytes: sourceBytes,
    rawValue: sourceMac,
    valid: true,
    warnings: [],
  });
  summaryParams.destinationMac = destinationMac;
  summaryParams.sourceMac = sourceMac;

  const chain = walkTypeLengthChain(data, MAC_LENGTH * 2, fields, warnings, errors);

  let actualKind: EthernetPageKind | 'undefined-range' = 'undefined-range';
  let summaryKey = SUMMARY_TRUNCATED_FRAME;

  if (chain.vlanTagCount > 0) {
    actualKind = 'vlan-802-1q';
    summaryKey = SUMMARY_VLAN_TAGGED_FRAME;
    summaryParams.vlanTagCount = String(chain.vlanTagCount);
  }

  if (chain.finalValue !== undefined) {
    const value = chain.finalValue;
    if (value >= ETHERTYPE_MIN) {
      if (chain.vlanTagCount === 0) actualKind = 'ethernet-ii';
      const name = ETHER_TYPE_NAMES.get(value);
      const etherTypeWarningKey = name === undefined ? WARN_UNKNOWN_ETHERTYPE : WARN_ETHERTYPE_HIGHER_LAYER;
      const etherTypeField: ParsedField = {
        id: 'ethertype',
        name: 'EtherType',
        offset: chain.cursor - TYPE_LENGTH_FIELD_LENGTH,
        length: TYPE_LENGTH_FIELD_LENGTH,
        rawBytes: data.slice(chain.cursor - TYPE_LENGTH_FIELD_LENGTH, chain.cursor),
        rawValue: value,
        valid: name !== undefined,
        warnings: [etherTypeWarningKey],
      };
      if (name !== undefined) etherTypeField.physicalValue = name;
      fields.push(etherTypeField);
      // Katman zinciri istisnası (karar 1): bilinen bir protokol ADLANDIRILIR ama
      // payload'ı ÇÖZMEZ — "şu sayfada çöz" uyarısı CAN'ın suggestHigherLayers
      // emsali. Bilinmeyen EtherType'ta ise adlandırma yok, ayrı uyarı basılır.
      warnings.push(etherTypeWarningKey);
      if (chain.vlanTagCount === 0) {
        summaryKey = SUMMARY_ETHERTYPE_FRAME;
        summaryParams.etherType = `0x${value.toString(HEX_RADIX).toUpperCase()}`;
        summaryParams.etherTypeName = name ?? 'Unknown';
      }
    } else if (value <= LENGTH_MAX) {
      if (chain.vlanTagCount === 0) actualKind = 'ieee-802-3';
      fields.push({
        id: 'length',
        name: 'Length',
        offset: chain.cursor - TYPE_LENGTH_FIELD_LENGTH,
        length: TYPE_LENGTH_FIELD_LENGTH,
        rawBytes: data.slice(chain.cursor - TYPE_LENGTH_FIELD_LENGTH, chain.cursor),
        rawValue: value,
        physicalValue: `IEEE 802.3 Payload Length = ${String(value)} bytes`,
        valid: true,
        warnings: [],
      });
      if (chain.vlanTagCount === 0) {
        summaryKey = SUMMARY_LENGTH_FRAME;
        summaryParams.length = String(value);
      }
    } else {
      // 1501-1535 (0x05DD-0x05FF): ne EtherType ne Length — UYARI, HATA değil.
      if (chain.vlanTagCount === 0) actualKind = 'undefined-range';
      fields.push({
        id: 'type-length',
        name: 'Type/Length',
        offset: chain.cursor - TYPE_LENGTH_FIELD_LENGTH,
        length: TYPE_LENGTH_FIELD_LENGTH,
        rawBytes: data.slice(chain.cursor - TYPE_LENGTH_FIELD_LENGTH, chain.cursor),
        rawValue: value,
        valid: false,
        warnings: [WARN_UNDEFINED_TYPE_LENGTH_RANGE],
      });
      warnings.push(WARN_UNDEFINED_TYPE_LENGTH_RANGE);
      if (chain.vlanTagCount === 0) {
        summaryKey = SUMMARY_UNDEFINED_RANGE_FRAME;
        summaryParams.value = `0x${value.toString(HEX_RADIX).toUpperCase()}`;
      }
    }

    const payload = data.slice(chain.cursor);
    if (payload.length > 0) {
      fields.push({
        id: 'payload',
        name: 'Payload',
        offset: chain.cursor,
        length: payload.length,
        rawBytes: payload,
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
  } else if (chain.tooManyVlanTags) {
    // Sayaç aşıldı: kalan her şey (tüketilmeyen TPID dahil) ham payload.
    const payload = data.slice(chain.cursor);
    if (payload.length > 0) {
      fields.push({
        id: 'payload',
        name: 'Payload',
        offset: chain.cursor,
        length: payload.length,
        rawBytes: payload,
        unit: 'B',
        warnings: [WARN_TOO_MANY_VLAN_TAGS],
        valid: true,
      });
    }
  }

  pushPageMismatchWarning(actualKind, options.expectedKind, warnings);
  fields.push(buildFcsField(data, warnings));

  return {
    fields,
    warnings,
    errors,
    metadata: {
      destinationMac,
      sourceMac,
      vlanTagCount: chain.vlanTagCount,
      summaryKey,
      summaryParams,
    },
  };
}
