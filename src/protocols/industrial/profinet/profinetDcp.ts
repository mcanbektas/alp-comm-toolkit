/**
 * PN-DCP (PROFINET Discovery and basic Configuration Protocol) çözücüsü.
 *
 * Faz 10, dalga 13e. `profinet.ts` FrameID'yi 0xFEFC-0xFEFF aralığında bulunca
 * BU dosyayı çağırır. Desen `cipCore.ts`/`iec104Asdu.ts`/`opcUaBinary.ts` ile
 * aynı: çekirdek çağıranın `fields` dizisine DOĞRUDAN alan basar ve bir
 * `Summary` döner — kendi başına bir `ProtocolParser` DEĞİLDİR.
 *
 * ── KAYNAK UYARISI ──────────────────────────────────────────────────────────
 * PI'nin IEC 61158-6-10 metni üyelik/ücret arkasındadır ve bu depoda YOKTUR.
 * Alan yerleşimleri İKİ bağımsız, kamuya açık kaynaktan ÇAPRAZ TEYİTLE alındı
 * (KOD KOPYALANMADI, yalnız format bilgisi doğrulandı):
 *   W = **Wireshark** `plugins/epan/profinet/packet-pn-dcp.c` (GPL-2.0-or-later,
 *       dosya başı "IEC 61158-6-10 section 4.3" der): `dissect_PNDCP_PDU()`
 *       başlığı ServiceID(1) → ServiceType(1) → Xid(4, ENC_BIG_ENDIAN) →
 *       ResponseDelay/Reserved(2) → DCPDataLength(2) sırasıyla okur;
 *       `dissect_PNDCP_Block()` blok başlığını Option(1)+Suboption(1)+
 *       DCPBlockLength(2) verir ve blok SONUNDA tek-uzunlukta 1 pad baytı ekler.
 *       https://github.com/wireshark/wireshark/tree/master/plugins/epan/profinet
 *   P = **p-net** (RT-Labs AB, GPLv3/ticari) `src/common/pf_dcp.c`:
 *       `pf_dcp_header_t { uint8_t service_id; uint8_t service_type;
 *       uint32_t xid; uint16_t response_delay_factor; uint16_t data_length; }`
 *       (üçü de "network endianness" yorumuyla) ve `pf_dcp_block_hdr_t
 *       { uint8_t option; uint8_t sub_option; uint16_t block_length; }`;
 *       `while ((*p_dst_pos) & 1)` / `while (src_pos & 1)` döngüleri pad'i
 *       "align on uint16_t" olarak bağımsız doğrular. `src/common/pf_dcp.h`
 *       Option/Suboption numaralarını W ile BİREBİR aynı verir.
 *       https://github.com/rtlabs-com/p-net
 * ÇAKIŞMA BULUNMADI. Yalnız İKİ kaynakta da AYNI numarayla geçen Option/
 * Suboption'lar adlandırıldı.
 *
 * ── TUZAK 1: BLOK ÇİFT UZUNLUĞA HİZALANIR ───────────────────────────────────
 * Bir blok Option(1)+Suboption(1)+DCPBlockLength(2) = 4 (çift) ile başlar,
 * dolayısıyla blok toplamının tekliği YALNIZ DCPBlockLength'in tekliğinden
 * gelir. Tek uzunluklu bloktan sonra 1 bayt PAD vardır ve pad `0x00`dır — yani
 * atlanmazsa sonraki HER blok bir bayt kayar ama küçük/tek bloklu örneklerde
 * hata görünmez. `cipCore.ts`in EPATH pad tuzağıyla AYNI SINIFTA bir tuzaktır;
 * `Control/Response` bloğu (değer = Option+Suboption+BlockError = 3 bayt) bunu
 * doğal olarak tetikler ve birim testi ile e2e turu bu vakayı kilitler.
 *
 * ── TUZAK 2: BLOCKINFO/BLOCKQUALIFIER DCPBlockLength'İN İÇİNDEDİR ───────────
 * İki kaynak da bu 2 baytı DCPBlockLength'ten DÜŞER (`block_length -= 2`).
 * Yani "değer" bölgesi = DCPBlockLength − (varsa 2). Ve varlıkları servise
 * bağlıdır, blokta bir bayrak YOKTUR:
 *   BlockInfo      → (Identify & yanıt) | (Hello & istek) | (Get & yanıt)
 *   BlockQualifier → (Set & istek)
 *
 * ── TUZAK 3: GET İSTEĞİNİN "BLOK"LARI UZUNLUK TAŞIMAZ ───────────────────────
 * ServiceID=Get + ServiceType=Request'te gövde blok değil SELECTOR listesidir:
 * yalnız Option(1)+Suboption(1) çiftleri, DCPBlockLength YOK. Genel blok
 * çözücüsüyle okunursa değer alanı çöp olur.
 *
 * ── KAPSAM — ne çözülür, ne HAM bırakılır ──────────────────────────────────
 * ÇÖZÜLÜR: DCP başlığının her alanı (ServiceType bit bit), blok zinciri,
 * pad baytları, ve iki kaynakta teyitli değer yerleşimleri (MAC, IP/Subnet/
 * Gateway, VisibleString'ler, VendorID/DeviceID, DeviceInstance, OEM ID,
 * Control/Response'un BlockError'ı, Device Options listesi).
 * HAM BIRAKILIR (bilerek): DeviceRole baytının BİT anlamları (W bütün baytı
 * "DeviceRoleDetails" diye tek parça gösteriyor, P yalnız uzunluğunu biliyor —
 * tek kaynakta bile bit adı yok), Full IP Suite'in IP/Mask/Gateway'den SONRAKİ
 * bölgesi (yalnız W'de, adlandırma belirsiz), DHCP ve NME (CIM) suboption
 * değerleri, üretici-özel (0x80-0xFE) blok değerleri.
 */

import type { ParsedField, ProtocolError } from '@/protocol-core/types';

/** DCP başlığı: ServiceID+ServiceType+Xid+ResponseDelay+DCPDataLength. */
export const DCP_HEADER_LENGTH = 10;
/** Blok başlığı: Option+Suboption+DCPBlockLength. */
export const DCP_BLOCK_HEADER_LENGTH = 4;
/** Get isteğinde blok yoktur; yalnız Option+Suboption seçici çiftleri gelir. */
const DCP_SELECTOR_LENGTH = 2;
/** BlockInfo ve BlockQualifier aynı genişlikte ve ikisi de uzunluğun İÇİNDE. */
const BLOCK_PREFIX_LENGTH = 2;

/**
 * Sonsuz döngü koruması. DCPDataLength 16 bit olduğu için en fazla 65535 bayt
 * tarif edebilir; en küçük blok 4 bayttır → fiziksel üst sınır ~16384. Bu sayı
 * Ethernet'in gerçekçi sınırının (1500 bayt → ~375 blok) üstünde ama
 * patolojik girdiyi durduracak kadar aşağıda seçildi (ethercat.ts emsali).
 */
const MAX_BLOCKS = 512;

const HEX_RADIX = 16;

export const ERROR_DCP_HEADER_TRUNCATED = 'protocol.profinet.error.dcpHeaderTruncated';
export const ERROR_DCP_BLOCK_TRUNCATED = 'protocol.profinet.error.dcpBlockTruncated';

export const WARN_DCP_UNKNOWN_SERVICE = 'protocol.profinet.warning.dcpUnknownService';
export const WARN_DCP_UNKNOWN_SERVICE_TYPE = 'protocol.profinet.warning.dcpUnknownServiceType';
export const WARN_DCP_RESERVED_BITS_SET = 'protocol.profinet.warning.dcpReservedBitsSet';
export const WARN_DCP_DATA_LENGTH_MISMATCH = 'protocol.profinet.warning.dcpDataLengthMismatch';
export const WARN_DCP_UNKNOWN_OPTION = 'protocol.profinet.warning.dcpUnknownOption';
export const WARN_DCP_VALUE_NOT_DECODED = 'protocol.profinet.warning.dcpValueNotDecoded';
export const WARN_DCP_PADDING_NOT_ZERO = 'protocol.profinet.warning.dcpPaddingNotZero';
export const WARN_DCP_BLOCK_LIMIT_REACHED = 'protocol.profinet.warning.dcpBlockLimitReached';
export const WARN_DCP_DEVICE_ROLE_BITS_UNKNOWN =
  'protocol.profinet.warning.dcpDeviceRoleBitsUnknown';
export const WARN_DCP_BLOCK_LENGTH_UNDERFLOW = 'protocol.profinet.warning.dcpBlockLengthUnderflow';

/** İki kaynakta da aynı numarayla geçen ServiceID'ler. */
const SERVICE_ID_GET = 0x03;
const SERVICE_ID_SET = 0x04;
const SERVICE_ID_IDENTIFY = 0x05;
const SERVICE_ID_HELLO = 0x06;

const SERVICE_ID_NAMES: ReadonlyMap<number, string> = new Map([
  [SERVICE_ID_GET, 'Get'],
  [SERVICE_ID_SET, 'Set'],
  [SERVICE_ID_IDENTIFY, 'Identify'],
  [SERVICE_ID_HELLO, 'Hello'],
]);

/** ServiceType bit maskeleri (W: `hf_pn_dcp_service_type_*`). */
const SERVICE_TYPE_SELECTION_MASK = 0x01;
const SERVICE_TYPE_RESERVED_LOW_MASK = 0x02;
const SERVICE_TYPE_RESPONSE_MASK = 0x04;
const SERVICE_TYPE_RESERVED_HIGH_MASK = 0xf8;

const OPTION_IP = 0x01;
const OPTION_DEVICE = 0x02;
const OPTION_DHCP = 0x03;
const OPTION_CONTROL = 0x05;
const OPTION_DEVICE_INITIATIVE = 0x06;
const OPTION_NME = 0x07;
const OPTION_MANUFACTURER_FIRST = 0x80;
const OPTION_MANUFACTURER_LAST = 0xfe;
const OPTION_ALL_SELECTOR = 0xff;

const OPTION_NAMES: ReadonlyMap<number, string> = new Map([
  [OPTION_IP, 'IP'],
  [OPTION_DEVICE, 'Device properties'],
  [OPTION_DHCP, 'DHCP'],
  [OPTION_CONTROL, 'Control'],
  [OPTION_DEVICE_INITIATIVE, 'Device Initiative'],
  [OPTION_NME, 'CIM / NME'],
  [OPTION_ALL_SELECTOR, 'All Selector'],
]);

const SUBOPTION_IP_MAC = 0x01;
const SUBOPTION_IP_PARAMETER = 0x02;
const SUBOPTION_IP_FULL_SUITE = 0x03;

const SUBOPTION_DEVICE_VENDOR = 0x01;
const SUBOPTION_DEVICE_NAME_OF_STATION = 0x02;
const SUBOPTION_DEVICE_ID = 0x03;
const SUBOPTION_DEVICE_ROLE = 0x04;
const SUBOPTION_DEVICE_OPTIONS = 0x05;
const SUBOPTION_DEVICE_ALIAS = 0x06;
const SUBOPTION_DEVICE_INSTANCE = 0x07;
const SUBOPTION_DEVICE_OEM_ID = 0x08;

const SUBOPTION_CONTROL_START = 0x01;
const SUBOPTION_CONTROL_END = 0x02;
const SUBOPTION_CONTROL_SIGNAL = 0x03;
const SUBOPTION_CONTROL_RESPONSE = 0x04;
const SUBOPTION_CONTROL_FACTORY_RESET = 0x05;
const SUBOPTION_CONTROL_RESET_TO_FACTORY = 0x06;

const SUBOPTION_DEVICE_INITIATIVE = 0x01;

const IP_SUBOPTION_NAMES: ReadonlyMap<number, string> = new Map([
  [SUBOPTION_IP_MAC, 'MAC address'],
  [SUBOPTION_IP_PARAMETER, 'IP parameter'],
  [SUBOPTION_IP_FULL_SUITE, 'Full IP suite'],
]);

const DEVICE_SUBOPTION_NAMES: ReadonlyMap<number, string> = new Map([
  [SUBOPTION_DEVICE_VENDOR, 'Manufacturer specific (Type of Station)'],
  [SUBOPTION_DEVICE_NAME_OF_STATION, 'Name of Station'],
  [SUBOPTION_DEVICE_ID, 'Device ID'],
  [SUBOPTION_DEVICE_ROLE, 'Device Role'],
  [SUBOPTION_DEVICE_OPTIONS, 'Device Options'],
  [SUBOPTION_DEVICE_ALIAS, 'Alias Name'],
  [SUBOPTION_DEVICE_INSTANCE, 'Device Instance'],
  [SUBOPTION_DEVICE_OEM_ID, 'OEM Device ID'],
]);

const CONTROL_SUBOPTION_NAMES: ReadonlyMap<number, string> = new Map([
  [SUBOPTION_CONTROL_START, 'Start Transaction'],
  [SUBOPTION_CONTROL_END, 'End Transaction'],
  [SUBOPTION_CONTROL_SIGNAL, 'Signal'],
  [SUBOPTION_CONTROL_RESPONSE, 'Response'],
  [SUBOPTION_CONTROL_FACTORY_RESET, 'Reset Factory Settings'],
  [SUBOPTION_CONTROL_RESET_TO_FACTORY, 'Reset to Factory'],
]);

/** Control/Response bloğundaki BlockError kodları — iki kaynakta da aynı. */
const BLOCK_ERROR_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'Ok'],
  [0x01, 'Option unsupported'],
  [0x02, 'Suboption unsupported or no DataSet available'],
  [0x03, 'Suboption not set'],
  [0x04, 'Resource error'],
  [0x05, 'SET not possible by local reasons'],
  [0x06, 'In operation, SET not possible'],
]);

/** IP suboption'ının BlockInfo değerleri (W `pn_dcp_suboption_ip_block_info`). */
const IP_BLOCK_INFO_NAMES: ReadonlyMap<number, string> = new Map([
  [0x0000, 'IP not set'],
  [0x0001, 'IP set'],
  [0x0002, 'IP set by DHCP'],
  [0x0080, 'IP not set (address conflict detected)'],
  [0x0081, 'IP set (address conflict detected)'],
  [0x0082, 'IP set by DHCP (address conflict detected)'],
]);

/** noUncheckedIndexedAccess: bayt erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** PROFINET'in TAMAMI network order'dır (iki kaynak da "network endianness"). */
function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    ((byteAt(data, offset) << 24) |
      (byteAt(data, offset + 1) << 16) |
      (byteAt(data, offset + 2) << 8) |
      byteAt(data, offset + 3)) >>>
    0
  );
}

function formatHex(value: number, digits: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(digits, '0')}`;
}

function formatIpv4(data: Uint8Array, offset: number): string {
  return [0, 1, 2, 3].map((index) => String(byteAt(data, offset + index))).join('.');
}

function formatMacBytes(data: Uint8Array, offset: number): string {
  return [0, 1, 2, 3, 4, 5]
    .map((index) => byteAt(data, offset + index).toString(HEX_RADIX).toUpperCase().padStart(2, '0'))
    .join(':');
}

/**
 * VisibleString → görüntülenebilir metin. Spec ISO/IEC 646 (ASCII) der ama
 * W'nin kendi yorumu sahada 8859-n baytlarının görüldüğünü not eder; bu yüzden
 * 0x20-0x7E dışındaki her bayt `.` ile gösterilir — uydurma çözümleme yok.
 */
function formatVisibleString(data: Uint8Array, offset: number, length: number): string {
  let text = '';
  for (let index = 0; index < length; index += 1) {
    const code = byteAt(data, offset + index);
    text += code >= 0x20 && code <= 0x7e ? String.fromCharCode(code) : '.';
  }
  return text;
}

export interface DcpDecodeSummary {
  readonly serviceId: number;
  readonly serviceLabel: string;
  readonly isResponse: boolean;
  readonly blockCount: number;
  readonly declaredDataLength: number;
  /** Başlık + bloklar + pad baytları toplamı. */
  readonly consumedBytes: number;
}

/** Blok değeri çözülürken paylaşılan bağlam — parametre listesi şişmesin diye. */
interface BlockContext {
  readonly data: Uint8Array;
  readonly fields: ParsedField[];
  readonly warnings: string[];
  readonly prefix: string;
  readonly label: string;
}

function pushValueField(
  context: BlockContext,
  idSuffix: string,
  name: string,
  offset: number,
  length: number,
  extra: {
    rawValue?: number | string;
    physicalValue?: string;
    warnings?: string[];
  } = {},
): void {
  const field: ParsedField = {
    id: `${context.prefix}-${idSuffix}`,
    name: `${context.label} — ${name}`,
    offset,
    length,
    rawBytes: context.data.slice(offset, offset + length),
    valid: true,
    warnings: extra.warnings ?? [],
  };
  if (extra.rawValue !== undefined) field.rawValue = extra.rawValue;
  if (extra.physicalValue !== undefined) field.physicalValue = extra.physicalValue;
  context.fields.push(field);
}

/**
 * Blok DEĞERİ bölgesini çözer. `valueOffset`/`valueLength` BlockInfo ve
 * BlockQualifier DÜŞÜLDÜKTEN SONRAKİ bölgeyi tarif eder (tuzak 2).
 * Yerleşimi iki kaynakta teyitli olmayan her şey tek parça HAM basılır.
 */
function decodeBlockValue(
  context: BlockContext,
  option: number,
  suboption: number,
  valueOffset: number,
  valueLength: number,
): void {
  if (valueLength <= 0) return;

  const { data } = context;

  if (option === OPTION_IP && suboption === SUBOPTION_IP_MAC && valueLength >= 6) {
    pushValueField(context, 'mac', 'MAC Address', valueOffset, 6, {
      rawValue: formatMacBytes(data, valueOffset),
    });
    return;
  }

  if (
    option === OPTION_IP &&
    (suboption === SUBOPTION_IP_PARAMETER || suboption === SUBOPTION_IP_FULL_SUITE) &&
    valueLength >= 12
  ) {
    pushValueField(context, 'ip-address', 'IP Address', valueOffset, 4, {
      rawValue: formatIpv4(data, valueOffset),
    });
    pushValueField(context, 'subnet-mask', 'Subnet Mask', valueOffset + 4, 4, {
      rawValue: formatIpv4(data, valueOffset + 4),
    });
    pushValueField(context, 'gateway', 'Standard Gateway', valueOffset + 8, 4, {
      rawValue: formatIpv4(data, valueOffset + 8),
    });
    if (valueLength > 12) {
      // Full IP Suite'in kalanı (DNS sunucuları) yalnız TEK kaynakta ve orada
      // da alan adları yeniden kullanılmış — adlandırmak uydurma olurdu.
      pushValueField(context, 'ip-suite-tail', 'Full IP Suite (rest)', valueOffset + 12, valueLength - 12, {
        warnings: [WARN_DCP_VALUE_NOT_DECODED],
      });
      context.warnings.push(WARN_DCP_VALUE_NOT_DECODED);
    }
    return;
  }

  if (option === OPTION_DEVICE) {
    if (
      suboption === SUBOPTION_DEVICE_VENDOR ||
      suboption === SUBOPTION_DEVICE_NAME_OF_STATION ||
      suboption === SUBOPTION_DEVICE_ALIAS
    ) {
      const name =
        suboption === SUBOPTION_DEVICE_VENDOR
          ? 'Type of Station'
          : suboption === SUBOPTION_DEVICE_NAME_OF_STATION
            ? 'Name of Station'
            : 'Alias Name';
      pushValueField(context, 'text', name, valueOffset, valueLength, {
        rawValue: formatVisibleString(data, valueOffset, valueLength),
      });
      return;
    }
    if (
      (suboption === SUBOPTION_DEVICE_ID || suboption === SUBOPTION_DEVICE_OEM_ID) &&
      valueLength >= 4
    ) {
      const vendorLabel = suboption === SUBOPTION_DEVICE_ID ? 'Vendor ID' : 'OEM Vendor ID';
      const deviceLabel = suboption === SUBOPTION_DEVICE_ID ? 'Device ID' : 'OEM Device ID';
      const vendorId = readUint16BE(data, valueOffset);
      const deviceId = readUint16BE(data, valueOffset + 2);
      pushValueField(context, 'vendor-id', vendorLabel, valueOffset, 2, {
        rawValue: vendorId,
        physicalValue: formatHex(vendorId, 4),
      });
      pushValueField(context, 'device-id', deviceLabel, valueOffset + 2, 2, {
        rawValue: deviceId,
        physicalValue: formatHex(deviceId, 4),
      });
      return;
    }
    if (suboption === SUBOPTION_DEVICE_ROLE && valueLength >= 1) {
      // Bit anlamları hiçbir kaynakta adlandırılmamış → ham bayt + uyarı.
      pushValueField(context, 'device-role', 'Device Role Details', valueOffset, 1, {
        rawValue: byteAt(data, valueOffset),
        warnings: [WARN_DCP_DEVICE_ROLE_BITS_UNKNOWN],
      });
      context.warnings.push(WARN_DCP_DEVICE_ROLE_BITS_UNKNOWN);
      if (valueLength > 1) {
        pushValueField(context, 'device-role-reserved', 'Reserved', valueOffset + 1, valueLength - 1);
      }
      return;
    }
    if (suboption === SUBOPTION_DEVICE_INSTANCE && valueLength >= 2) {
      pushValueField(context, 'device-instance', 'Device Instance', valueOffset, 2, {
        rawValue: readUint16BE(data, valueOffset),
      });
      return;
    }
    if (suboption === SUBOPTION_DEVICE_OPTIONS) {
      // Option/Suboption çiftlerinin listesi — her çift KENDİ ofsetiyle basılır.
      const pairCount = Math.floor(valueLength / 2);
      for (let index = 0; index < pairCount; index += 1) {
        const pairOffset = valueOffset + index * 2;
        const pairOption = byteAt(data, pairOffset);
        const pairSuboption = byteAt(data, pairOffset + 1);
        const optionName = OPTION_NAMES.get(pairOption);
        pushValueField(
          context,
          `supported-${String(pairOffset)}`,
          `Supported Option #${String(index + 1)}`,
          pairOffset,
          2,
          {
            rawValue: (pairOption << 8) | pairSuboption,
            physicalValue: `${optionName ?? formatHex(pairOption, 2)} / ${formatHex(pairSuboption, 2)}`,
          },
        );
      }
      if (valueLength % 2 !== 0) {
        pushValueField(context, 'options-tail', 'Unpaired byte', valueOffset + pairCount * 2, 1, {
          warnings: [WARN_DCP_VALUE_NOT_DECODED],
        });
        context.warnings.push(WARN_DCP_VALUE_NOT_DECODED);
      }
      return;
    }
  }

  if (option === OPTION_CONTROL && suboption === SUBOPTION_CONTROL_RESPONSE && valueLength >= 3) {
    const respondedOption = byteAt(data, valueOffset);
    const respondedSuboption = byteAt(data, valueOffset + 1);
    const blockError = byteAt(data, valueOffset + 2);
    pushValueField(context, 'response-option', 'Responded Option', valueOffset, 1, {
      rawValue: respondedOption,
      physicalValue: OPTION_NAMES.get(respondedOption) ?? formatHex(respondedOption, 2),
    });
    pushValueField(context, 'response-suboption', 'Responded Suboption', valueOffset + 1, 1, {
      rawValue: respondedSuboption,
    });
    const errorName = BLOCK_ERROR_NAMES.get(blockError);
    pushValueField(context, 'block-error', 'BlockError', valueOffset + 2, 1, {
      rawValue: blockError,
      ...(errorName === undefined ? {} : { physicalValue: errorName }),
      ...(errorName === undefined ? { warnings: [WARN_DCP_VALUE_NOT_DECODED] } : {}),
    });
    if (errorName === undefined) context.warnings.push(WARN_DCP_VALUE_NOT_DECODED);
    return;
  }

  if (option === OPTION_CONTROL && suboption === SUBOPTION_CONTROL_SIGNAL && valueLength >= 2) {
    const signal = readUint16BE(data, valueOffset);
    pushValueField(context, 'signal-value', 'Signal Value', valueOffset, 2, {
      rawValue: signal,
      // 0x0100 = "Flash Once" iki kaynakta da tek tanımlı değerdir.
      ...(signal === 0x0100 ? { physicalValue: 'Flash Once' } : {}),
    });
    return;
  }

  if (
    option === OPTION_DEVICE_INITIATIVE &&
    suboption === SUBOPTION_DEVICE_INITIATIVE &&
    valueLength >= 2
  ) {
    const value = readUint16BE(data, valueOffset);
    pushValueField(context, 'device-initiative', 'Device Initiative', valueOffset, 2, {
      rawValue: value,
      physicalValue:
        value === 0x0001
          ? 'Device issues a DCP Hello request after power on'
          : value === 0x0000
            ? 'Device does not issue a DCP Hello request after power on'
            : formatHex(value, 4),
    });
    return;
  }

  // Buraya düşen her şey: yerleşimi iki kaynakta teyitli DEĞİL → HAM.
  pushValueField(context, 'value', 'Value', valueOffset, valueLength, {
    warnings: [WARN_DCP_VALUE_NOT_DECODED],
  });
  context.warnings.push(WARN_DCP_VALUE_NOT_DECODED);
}

function optionLabel(option: number): string {
  const known = OPTION_NAMES.get(option);
  if (known !== undefined) return known;
  if (option >= OPTION_MANUFACTURER_FIRST && option <= OPTION_MANUFACTURER_LAST) {
    return 'Manufacturer specific';
  }
  return '';
}

function suboptionLabel(option: number, suboption: number): string {
  if (option === OPTION_IP) return IP_SUBOPTION_NAMES.get(suboption) ?? '';
  if (option === OPTION_DEVICE) return DEVICE_SUBOPTION_NAMES.get(suboption) ?? '';
  if (option === OPTION_CONTROL) return CONTROL_SUBOPTION_NAMES.get(suboption) ?? '';
  if (option === OPTION_DEVICE_INITIATIVE && suboption === SUBOPTION_DEVICE_INITIATIVE) {
    return 'Device Initiative';
  }
  if (option === OPTION_ALL_SELECTOR && suboption === OPTION_ALL_SELECTOR) return 'All';
  return '';
}

/** Option+Suboption çiftini basar; Get isteğindeki seçiciler de bunu kullanır. */
function pushOptionPair(
  context: BlockContext,
  offset: number,
  option: number,
  suboption: number,
): void {
  const optionName = optionLabel(option);
  const optionField: ParsedField = {
    id: `${context.prefix}-option`,
    name: `${context.label} — Option`,
    offset,
    length: 1,
    rawBytes: context.data.slice(offset, offset + 1),
    rawValue: option,
    valid: optionName !== '',
    warnings: [],
  };
  if (optionName === '') {
    optionField.warnings.push(WARN_DCP_UNKNOWN_OPTION);
    context.warnings.push(WARN_DCP_UNKNOWN_OPTION);
  } else {
    optionField.physicalValue = optionName;
  }
  context.fields.push(optionField);

  const subName = suboptionLabel(option, suboption);
  const suboptionField: ParsedField = {
    id: `${context.prefix}-suboption`,
    name: `${context.label} — Suboption`,
    offset: offset + 1,
    length: 1,
    rawBytes: context.data.slice(offset + 1, offset + 2),
    rawValue: suboption,
    valid: true,
    warnings: [],
  };
  if (subName === '') {
    suboptionField.warnings.push(WARN_DCP_UNKNOWN_OPTION);
  } else {
    suboptionField.physicalValue = subName;
  }
  context.fields.push(suboptionField);
}

/**
 * TEK bir bloğu çözer. `offset` Option baytıdır, `limit` blok bölgesinin sonu.
 * Fırlatmaz: yer yetmezse hata basıp `undefined` döner ve zincir durur.
 * Dönen değer PAD DAHİL tüketilen bayt sayısıdır (tuzak 1).
 */
function decodeBlock(
  data: Uint8Array,
  offset: number,
  limit: number,
  index: number,
  serviceId: number,
  isResponse: boolean,
  fields: ParsedField[],
  warnings: string[],
  errors: ProtocolError[],
): number | undefined {
  const context: BlockContext = {
    data,
    fields,
    warnings,
    prefix: `dcp-block-${String(index)}`,
    label: `DCP Block #${String(index + 1)}`,
  };

  // Tuzak 3: Get isteğinde uzunluk alanı YOK, yalnız seçici çiftleri var.
  const isSelectorList = serviceId === SERVICE_ID_GET && !isResponse;
  const headerLength = isSelectorList ? DCP_SELECTOR_LENGTH : DCP_BLOCK_HEADER_LENGTH;

  if (limit - offset < headerLength) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_DCP_BLOCK_TRUNCATED,
      offset,
      length: Math.max(0, limit - offset),
    });
    return undefined;
  }

  const option = byteAt(data, offset);
  const suboption = byteAt(data, offset + 1);
  pushOptionPair(context, offset, option, suboption);

  if (isSelectorList) return DCP_SELECTOR_LENGTH;

  const lengthOffset = offset + 2;
  const declaredBlockLength = readUint16BE(data, lengthOffset);
  fields.push({
    id: `${context.prefix}-length`,
    name: `${context.label} — DCPBlockLength`,
    offset: lengthOffset,
    length: 2,
    rawBytes: data.slice(lengthOffset, lengthOffset + 2),
    rawValue: declaredBlockLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const blockEnd = offset + DCP_BLOCK_HEADER_LENGTH + declaredBlockLength;
  if (blockEnd > limit) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_DCP_BLOCK_TRUNCATED,
      offset: offset + DCP_BLOCK_HEADER_LENGTH,
      length: Math.max(0, limit - offset - DCP_BLOCK_HEADER_LENGTH),
      details: { declaredBlockLength, availableBytes: Math.max(0, limit - offset - DCP_BLOCK_HEADER_LENGTH) },
    });
    return undefined;
  }

  // Tuzak 2: bu iki bayt DCPBlockLength'in İÇİNDEdir ve varlıkları servise bağlı.
  const hasBlockInfo =
    (serviceId === SERVICE_ID_IDENTIFY && isResponse) ||
    (serviceId === SERVICE_ID_HELLO && !isResponse) ||
    (serviceId === SERVICE_ID_GET && isResponse);
  const hasBlockQualifier = serviceId === SERVICE_ID_SET && !isResponse;

  let cursor = offset + DCP_BLOCK_HEADER_LENGTH;
  let valueLength = declaredBlockLength;

  if (hasBlockInfo && declaredBlockLength >= BLOCK_PREFIX_LENGTH) {
    const blockInfo = readUint16BE(data, cursor);
    const infoName = option === OPTION_IP ? IP_BLOCK_INFO_NAMES.get(blockInfo) : undefined;
    fields.push({
      id: `${context.prefix}-block-info`,
      name: `${context.label} — BlockInfo`,
      offset: cursor,
      length: BLOCK_PREFIX_LENGTH,
      rawBytes: data.slice(cursor, cursor + BLOCK_PREFIX_LENGTH),
      rawValue: blockInfo,
      ...(infoName === undefined ? {} : { physicalValue: infoName }),
      valid: true,
      warnings: [],
    });
    cursor += BLOCK_PREFIX_LENGTH;
    valueLength -= BLOCK_PREFIX_LENGTH;
  } else if (hasBlockQualifier && declaredBlockLength >= BLOCK_PREFIX_LENGTH) {
    const qualifier = readUint16BE(data, cursor);
    fields.push({
      id: `${context.prefix}-block-qualifier`,
      name: `${context.label} — BlockQualifier`,
      offset: cursor,
      length: BLOCK_PREFIX_LENGTH,
      rawBytes: data.slice(cursor, cursor + BLOCK_PREFIX_LENGTH),
      rawValue: qualifier,
      // İki kaynakta da yalnız bu iki değer tanımlı; kalanı ayrılmış.
      ...(qualifier === 0x0000
        ? { physicalValue: 'Use the value temporarily' }
        : qualifier === 0x0001
          ? { physicalValue: 'Save the value permanently' }
          : {}),
      valid: true,
      warnings: [],
    });
    cursor += BLOCK_PREFIX_LENGTH;
    valueLength -= BLOCK_PREFIX_LENGTH;
  } else if ((hasBlockInfo || hasBlockQualifier) && declaredBlockLength > 0) {
    // Servis bu ön eki ZORUNLU kılıyor ama uzunluk 2'ye bile yetmiyor.
    warnings.push(WARN_DCP_BLOCK_LENGTH_UNDERFLOW);
  }

  decodeBlockValue(context, option, suboption, cursor, valueLength);

  // Tuzak 1: blok toplamı tekse 1 bayt pad. Bölgede yer yoksa pad basılmaz.
  const totalWithoutPadding = DCP_BLOCK_HEADER_LENGTH + declaredBlockLength;
  const needsPadding = (totalWithoutPadding & 1) === 1 && blockEnd < limit;
  if (!needsPadding) return totalWithoutPadding;

  const paddingByte = byteAt(data, blockEnd);
  const paddingField: ParsedField = {
    id: `${context.prefix}-padding`,
    name: `${context.label} — Padding`,
    offset: blockEnd,
    length: 1,
    rawBytes: data.slice(blockEnd, blockEnd + 1),
    rawValue: paddingByte,
    valid: paddingByte === 0,
    warnings: [],
  };
  if (paddingByte !== 0) {
    paddingField.warnings.push(WARN_DCP_PADDING_NOT_ZERO);
    warnings.push(WARN_DCP_PADDING_NOT_ZERO);
  }
  fields.push(paddingField);
  return totalWithoutPadding + 1;
}

/**
 * DCP PDU'sunu çözer. `offset` ServiceID baytı, `limit` çerçevenin (dolgu
 * dışındaki) sonu. Başlık kesikse `undefined` döner; blok zincirindeki hata
 * KISMİ çözümü bozmaz (spec §47: hatalı veride kısmi sonuç gösterilir).
 */
export function decodeDcpPdu(
  data: Uint8Array,
  offset: number,
  limit: number,
  fields: ParsedField[],
  warnings: string[],
  errors: ProtocolError[],
): DcpDecodeSummary | undefined {
  if (limit - offset < DCP_HEADER_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_DCP_HEADER_TRUNCATED,
      offset,
      length: Math.max(0, limit - offset),
      details: { availableBytes: Math.max(0, limit - offset), requiredBytes: DCP_HEADER_LENGTH },
    });
    return undefined;
  }

  const serviceId = byteAt(data, offset);
  const serviceName = SERVICE_ID_NAMES.get(serviceId);
  const serviceIdField: ParsedField = {
    id: 'dcp-service-id',
    name: 'DCP ServiceID',
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: serviceId,
    valid: serviceName !== undefined,
    warnings: [],
  };
  if (serviceName === undefined) {
    serviceIdField.warnings.push(WARN_DCP_UNKNOWN_SERVICE);
    warnings.push(WARN_DCP_UNKNOWN_SERVICE);
  } else {
    serviceIdField.physicalValue = serviceName;
  }
  fields.push(serviceIdField);

  const serviceTypeOffset = offset + 1;
  const serviceType = byteAt(data, serviceTypeOffset);
  const serviceTypeBytes = data.slice(serviceTypeOffset, serviceTypeOffset + 1);
  const isResponse = (serviceType & SERVICE_TYPE_SELECTION_MASK) !== 0;
  const responseBit = (serviceType & SERVICE_TYPE_RESPONSE_MASK) !== 0;
  const reservedBits =
    (serviceType & SERVICE_TYPE_RESERVED_LOW_MASK) | (serviceType & SERVICE_TYPE_RESERVED_HIGH_MASK);

  fields.push({
    id: 'dcp-service-type-selection',
    name: 'DCP ServiceType — Selection (bit 0)',
    offset: serviceTypeOffset,
    length: 1,
    rawBytes: serviceTypeBytes,
    rawValue: isResponse ? 1 : 0,
    physicalValue: isResponse ? 'Response' : 'Request',
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'dcp-service-type-response',
    name: 'DCP ServiceType — Response (bit 2)',
    offset: serviceTypeOffset,
    length: 1,
    rawBytes: serviceTypeBytes,
    rawValue: responseBit ? 1 : 0,
    physicalValue: responseBit ? 'ServiceID not supported' : 'Success',
    valid: true,
    warnings: [],
  });
  const reservedField: ParsedField = {
    id: 'dcp-service-type-reserved',
    name: 'DCP ServiceType — Reserved (bit 1, 3-7)',
    offset: serviceTypeOffset,
    length: 1,
    rawBytes: serviceTypeBytes,
    rawValue: reservedBits,
    valid: reservedBits === 0,
    warnings: [],
  };
  if (reservedBits !== 0) {
    reservedField.warnings.push(WARN_DCP_RESERVED_BITS_SET);
    warnings.push(WARN_DCP_RESERVED_BITS_SET);
  }
  fields.push(reservedField);

  // İki kaynakta da tanımlı olan üç ServiceType: 0 (Req), 1 (Ok), 5 (unsupported).
  if (serviceType !== 0x00 && serviceType !== 0x01 && serviceType !== 0x05) {
    warnings.push(WARN_DCP_UNKNOWN_SERVICE_TYPE);
  }

  const xidOffset = offset + 2;
  const xid = readUint32BE(data, xidOffset);
  fields.push({
    id: 'dcp-xid',
    name: 'DCP Xid',
    offset: xidOffset,
    length: 4,
    rawBytes: data.slice(xidOffset, xidOffset + 4),
    rawValue: xid,
    physicalValue: formatHex(xid, 8),
    valid: true,
    warnings: [],
  });

  const delayOffset = offset + 6;
  const delayValue = readUint16BE(data, delayOffset);
  // Aynı 2 bayt: Identify isteğinde ResponseDelayFactor, diğer her yerde Reserved.
  const isMulticastIdentify = serviceId === SERVICE_ID_IDENTIFY && !isResponse;
  const delayField: ParsedField = {
    id: 'dcp-response-delay',
    name: isMulticastIdentify ? 'DCP ResponseDelayFactor' : 'DCP Reserved',
    offset: delayOffset,
    length: 2,
    rawBytes: data.slice(delayOffset, delayOffset + 2),
    rawValue: delayValue,
    valid: isMulticastIdentify || delayValue === 0,
    warnings: [],
  };
  if (!isMulticastIdentify && delayValue !== 0) {
    delayField.warnings.push(WARN_DCP_RESERVED_BITS_SET);
    warnings.push(WARN_DCP_RESERVED_BITS_SET);
  }
  fields.push(delayField);

  const dataLengthOffset = offset + 8;
  const declaredDataLength = readUint16BE(data, dataLengthOffset);
  fields.push({
    id: 'dcp-data-length',
    name: 'DCP DCPDataLength',
    offset: dataLengthOffset,
    length: 2,
    rawBytes: data.slice(dataLengthOffset, dataLengthOffset + 2),
    rawValue: declaredDataLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const blocksStart = offset + DCP_HEADER_LENGTH;
  const availableBlockBytes = Math.max(0, limit - blocksStart);
  if (declaredDataLength > availableBlockBytes) {
    errors.push({
      code: 'length-mismatch',
      message: ERROR_DCP_BLOCK_TRUNCATED,
      offset: blocksStart,
      length: availableBlockBytes,
      details: { declaredDataLength, availableBytes: availableBlockBytes },
    });
  }
  const blockLimit = blocksStart + Math.min(declaredDataLength, availableBlockBytes);

  let cursor = blocksStart;
  let blockCount = 0;
  while (cursor < blockLimit) {
    if (blockCount >= MAX_BLOCKS) {
      warnings.push(WARN_DCP_BLOCK_LIMIT_REACHED);
      break;
    }
    const consumed = decodeBlock(
      data,
      cursor,
      blockLimit,
      blockCount,
      serviceId,
      isResponse,
      fields,
      warnings,
      errors,
    );
    if (consumed === undefined || consumed <= 0) {
      cursor = blockLimit;
      break;
    }
    blockCount += 1;
    cursor += consumed;
  }

  // DCPDataLength'in vaadi ile gerçek tüketim uyuşmuyorsa uyar: pad baytı
  // atlanmış bir çözücüde tam olarak burası kayar (tuzak 1'in bekçisi).
  if (blockCount > 0 && cursor !== blockLimit) {
    warnings.push(WARN_DCP_DATA_LENGTH_MISMATCH);
  }

  return {
    serviceId,
    serviceLabel: serviceName ?? formatHex(serviceId, 2),
    isResponse,
    blockCount,
    declaredDataLength,
    consumedBytes: Math.max(cursor, blockLimit) - offset,
  };
}
