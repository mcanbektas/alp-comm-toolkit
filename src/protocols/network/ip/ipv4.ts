/**
 * IPv4 (RFC 791) — internet katmanı başlığı. Girdi bir IP DATAGRAMIdır (Ethernet
 * çerçevesi DEĞİL): version/IHL baytından başlar. Ethernet motorunun EtherType
 * 0x0800 adlandırdığı payload'ı buraya elle taşımak kullanıcının işi — motorlar
 * zincir KURMAZ (karar 1, brief-faz10-dalga4.md).
 *
 * ── KATMAN ZİNCİRİ İSTİSNASI (karar 1) ──────────────────────────────────────
 * `Protocol` alanı (offset 9) dar bir kümede (1=ICMP, 6=TCP, 17=UDP) ADLANDIRILIR
 * ama payload ÇÖZÜLMEZ — `ethernetFrame.ts`teki EtherType deseninin BİREBİR
 * emsali: bilinen değer `valid:true` + "üst katmanı şu sayfada çöz" uyarısı,
 * bilinmeyen değer `valid:false` + ayrı "tanınmayan" uyarısı.
 *
 * ── HEADER CHECKSUM: TAM DOĞRULANIR (karar 2'nin farklı olduğu tek alan) ────
 * IPv4 checksum'ı yalnız BAŞLIĞI kapsar (RFC 1071, `internetChecksum.ts`) ve
 * pseudo-header İSTEMEZ — TCP/UDP'nin aksine tek segmentten eksiksiz
 * hesaplanabilir. Bu yüzden burada PASS/FAIL gerçek doğrulamadır (spec
 * 26157-26179), `checksum-mismatch` normal biçimde basılır (UBX/RTCM emsali,
 * MAVLink'in "doğrulanamaz" istisnası DEĞİL). Tek istisna: IHL yapısal olarak
 * geçersizse (< 5) ya da başlık tampanda eksikse, hangi bayt aralığının
 * "başlık" sayılacağı bilinmediği için doğrulama ATLANIR (`checksumVerification
 * Skipped` uyarısı) — bu durumda da checksum-mismatch YANLIŞ pozitif üretmez.
 *
 * ── IHL < 5 VE TOTAL LENGTH < IHL·4 AYRI HATALARDIR ──────────────────────────
 * İkisi de spec'in açık şartı (26131-26179). IHL yapısal olarak imkânsızsa
 * (`value-out-of-range`) DSCP/TTL/Protocol/Adres gibi SABİT ofsetli alanlar
 * yine de gösterilir (kısmi çözüm, spec §47) — yalnız Options/Payload/Checksum-
 * doğrulaması, sınırları (IHL·4) geçersiz bir değere bağlı olduğu için atlanır.
 * Total Length kendi başına ayrı bir tutarlılık şartıdır (`length-mismatch`) ve
 * IHL geçerli olsa bile ihlal edilebilir.
 *
 * ── FRAGMENTATION ALAN OLARAK GÖSTERİLİR, BİRLEŞTİRİLMEZ ────────────────────
 * Flags(3 bit: reserved/DF/MF) ve Fragment Offset(13 bit) çözülür ama REASSEMBLY
 * YAPILMAZ — çok paket ister, bu analyzer'ın işi (spec 26181-26277, MAVLink'in
 * seq-loss hesabını parser'a koymama kararıyla aynı sınır).
 */

import { computeInternetChecksumWithFieldZeroed } from '@/protocol-core/checksums/internetChecksum';
import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'ipv4';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'IPv4';

/** Version(4b)+IHL(4b) + DSCP/ECN(1B) + TotalLength(2B) + Id(2B) + Flags/FragOff(2B)
 * + TTL(1B) + Protocol(1B) + Checksum(2B) + Src(4B) + Dst(4B) — options'sız asgari. */
const MIN_HEADER_LENGTH = 20;
/** IHL 32-bit KELİME sayar; 20 bayt = 5 kelime altı yapısal olarak imkânsızdır. */
const MIN_IHL_WORDS = 5;
const IHL_TO_BYTES = 4;

const VERSION_OFFSET = 0;
const DSCP_ECN_OFFSET = 1;
const TOTAL_LENGTH_OFFSET = 2;
const IDENTIFICATION_OFFSET = 4;
const FLAGS_FRAGMENT_OFFSET = 6;
const TTL_OFFSET = 8;
const PROTOCOL_OFFSET = 9;
const CHECKSUM_OFFSET = 10;
const SOURCE_ADDRESS_OFFSET = 12;
const DESTINATION_ADDRESS_OFFSET = 16;

const WORD_LENGTH = 2;
const ADDRESS_LENGTH = 4;
const EXPECTED_VERSION = 4;

const DSCP_SHIFT = 2;
const ECN_MASK = 0x3;
const FRAGMENT_RESERVED_SHIFT = 15;
const FRAGMENT_DF_SHIFT = 14;
const FRAGMENT_MF_SHIFT = 13;
const FRAGMENT_OFFSET_MASK = 0x1fff;

const HEX_RADIX = 16;
const HEX_DIGITS_16BIT = 4;

const ERROR_FRAME_TOO_SHORT = 'protocol.ipv4.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.ipv4.error.frameTooLong';
const ERROR_ABORTED = 'protocol.ipv4.error.aborted';
const ERROR_IHL_TOO_SMALL = 'protocol.ipv4.error.ihlTooSmall';
const ERROR_TOTAL_LENGTH_TOO_SMALL = 'protocol.ipv4.error.totalLengthTooSmall';
const ERROR_HEADER_CHECKSUM_MISMATCH = 'protocol.ipv4.error.headerChecksumMismatch';

const WARN_UNEXPECTED_VERSION = 'protocol.ipv4.warning.unexpectedVersion';
const WARN_PROTOCOL_HIGHER_LAYER = 'protocol.ipv4.warning.protocolHigherLayer';
const WARN_UNKNOWN_PROTOCOL = 'protocol.ipv4.warning.unknownProtocol';
const WARN_CHECKSUM_VERIFICATION_SKIPPED = 'protocol.ipv4.warning.checksumVerificationSkipped';

/** Bu depoda dar tutulan Protocol adlandırma kümesi (spec 26131-26144, karar 1). */
const PROTOCOL_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'ICMP'],
  [6, 'TCP'],
  [17, 'UDP'],
]);

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function formatHex16(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(HEX_DIGITS_16BIT, '0')}`;
}

function formatIpv4Address(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String(byte)).join('.');
}

interface Ipv4ParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseIpv4Frame(data: Uint8Array, options: Ipv4ParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    // İptal beklenen bir sonuçtur, hata değil (spec §41).
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
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

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const versionIhlByte = byteAt(data, VERSION_OFFSET);
  const version = versionIhlByte >>> 4;
  const ihl = versionIhlByte & 0x0f;
  const declaredHeaderLength = ihl * IHL_TO_BYTES;
  const ihlValid = ihl >= MIN_IHL_WORDS;

  const versionField: ParsedField = {
    id: 'version',
    name: 'Version',
    offset: VERSION_OFFSET,
    length: 1,
    rawBytes: data.slice(VERSION_OFFSET, VERSION_OFFSET + 1),
    rawValue: version,
    valid: true,
    warnings: [],
  };
  if (version !== EXPECTED_VERSION) {
    versionField.warnings = [WARN_UNEXPECTED_VERSION];
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_VERSION));
  }
  fields.push(versionField);

  const ihlField: ParsedField = {
    id: 'ihl',
    name: 'IHL',
    offset: VERSION_OFFSET,
    length: 1,
    rawBytes: data.slice(VERSION_OFFSET, VERSION_OFFSET + 1),
    rawValue: ihl,
    physicalValue: `${String(declaredHeaderLength)} bytes`,
    valid: ihlValid,
    warnings: [],
  };
  fields.push(ihlField);
  if (!ihlValid) {
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_IHL_TOO_SMALL,
      offset: VERSION_OFFSET,
      length: 1,
      details: { ihl, minimumIhl: MIN_IHL_WORDS },
    });
  }

  const dscpEcnByte = byteAt(data, DSCP_ECN_OFFSET);
  const dscp = dscpEcnByte >>> DSCP_SHIFT;
  const ecn = dscpEcnByte & ECN_MASK;
  const dscpEcnBytes = data.slice(DSCP_ECN_OFFSET, DSCP_ECN_OFFSET + 1);
  fields.push({
    id: 'dscp',
    name: 'DSCP',
    offset: DSCP_ECN_OFFSET,
    length: 1,
    rawBytes: dscpEcnBytes,
    rawValue: dscp,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'ecn',
    name: 'ECN',
    offset: DSCP_ECN_OFFSET,
    length: 1,
    rawBytes: dscpEcnBytes,
    rawValue: ecn,
    valid: true,
    warnings: [],
  });

  const totalLength = readUint16BE(data, TOTAL_LENGTH_OFFSET);
  const totalLengthField: ParsedField = {
    id: 'total-length',
    name: 'Total Length',
    offset: TOTAL_LENGTH_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(TOTAL_LENGTH_OFFSET, TOTAL_LENGTH_OFFSET + WORD_LENGTH),
    rawValue: totalLength,
    unit: 'B',
    valid: true,
    warnings: [],
  };
  if (totalLength < declaredHeaderLength) {
    totalLengthField.valid = false;
    errors.push({
      code: 'length-mismatch',
      message: ERROR_TOTAL_LENGTH_TOO_SMALL,
      offset: TOTAL_LENGTH_OFFSET,
      length: WORD_LENGTH,
      details: { totalLength, declaredHeaderLength },
    });
  }
  fields.push(totalLengthField);

  const identification = readUint16BE(data, IDENTIFICATION_OFFSET);
  fields.push({
    id: 'identification',
    name: 'Identification',
    offset: IDENTIFICATION_OFFSET,
    length: WORD_LENGTH,
    rawBytes: data.slice(IDENTIFICATION_OFFSET, IDENTIFICATION_OFFSET + WORD_LENGTH),
    rawValue: identification,
    valid: true,
    warnings: [],
  });

  // Flags(3 bit)/Fragment Offset(13 bit): alan olarak çözülür, REASSEMBLY YOK
  // (dosya başı — çok paket ister, analyzer'ın işi).
  const flagsFragmentValue = readUint16BE(data, FLAGS_FRAGMENT_OFFSET);
  const flagsFragmentBytes = data.slice(FLAGS_FRAGMENT_OFFSET, FLAGS_FRAGMENT_OFFSET + WORD_LENGTH);
  const reservedFlag = (flagsFragmentValue >>> FRAGMENT_RESERVED_SHIFT) & 0x1;
  const dontFragment = (flagsFragmentValue >>> FRAGMENT_DF_SHIFT) & 0x1;
  const moreFragments = (flagsFragmentValue >>> FRAGMENT_MF_SHIFT) & 0x1;
  const fragmentOffset = flagsFragmentValue & FRAGMENT_OFFSET_MASK;
  fields.push({
    id: 'flags-reserved',
    name: 'Flags — Reserved',
    offset: FLAGS_FRAGMENT_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsFragmentBytes,
    rawValue: reservedFlag,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'flags-df',
    name: 'Flags — Don’t Fragment',
    offset: FLAGS_FRAGMENT_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsFragmentBytes,
    rawValue: dontFragment,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'flags-mf',
    name: 'Flags — More Fragments',
    offset: FLAGS_FRAGMENT_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsFragmentBytes,
    rawValue: moreFragments,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'fragment-offset',
    name: 'Fragment Offset',
    offset: FLAGS_FRAGMENT_OFFSET,
    length: WORD_LENGTH,
    rawBytes: flagsFragmentBytes,
    rawValue: fragmentOffset,
    valid: true,
    warnings: [],
  });

  const ttl = byteAt(data, TTL_OFFSET);
  fields.push({
    id: 'ttl',
    name: 'TTL',
    offset: TTL_OFFSET,
    length: 1,
    rawBytes: data.slice(TTL_OFFSET, TTL_OFFSET + 1),
    rawValue: ttl,
    valid: true,
    warnings: [],
  });

  const protocolValue = byteAt(data, PROTOCOL_OFFSET);
  const protocolName = PROTOCOL_NAMES.get(protocolValue);
  const protocolWarningKey = protocolName === undefined ? WARN_UNKNOWN_PROTOCOL : WARN_PROTOCOL_HIGHER_LAYER;
  const protocolField: ParsedField = {
    id: 'protocol',
    name: 'Protocol',
    offset: PROTOCOL_OFFSET,
    length: 1,
    rawBytes: data.slice(PROTOCOL_OFFSET, PROTOCOL_OFFSET + 1),
    rawValue: protocolValue,
    valid: protocolName !== undefined,
    warnings: [protocolWarningKey],
  };
  if (protocolName !== undefined) protocolField.physicalValue = protocolName;
  fields.push(protocolField);
  // Katman zinciri istisnası (karar 1): bilinen bir protokol ADLANDIRILIR ama
  // payload'ı ÇÖZMEZ — "şu sayfada çöz" uyarısı, ethernetFrame.ts'teki EtherType
  // deseninin birebir emsali.
  warnings.push(toProtocolWarning(protocolWarningKey));

  const canVerifyChecksum = ihlValid && data.length >= declaredHeaderLength;
  const receivedChecksum = readUint16BE(data, CHECKSUM_OFFSET);
  const checksumBytes = data.slice(CHECKSUM_OFFSET, CHECKSUM_OFFSET + WORD_LENGTH);
  const checksumField: ParsedField = {
    id: 'checksum',
    name: 'Header Checksum',
    offset: CHECKSUM_OFFSET,
    length: WORD_LENGTH,
    rawBytes: checksumBytes,
    rawValue: receivedChecksum,
    valid: true,
    warnings: [],
  };
  if (canVerifyChecksum) {
    // Pseudo-header İSTEMEZ (dosya başı) — başlığın kendisi (yalnız declaredHeaderLength
    // bayt, options dahil) yeterli. UBX/RTCM'in checksum PASS/FAIL deseni.
    const headerBytes = data.slice(0, declaredHeaderLength);
    const computedChecksum = computeInternetChecksumWithFieldZeroed(headerBytes, CHECKSUM_OFFSET, WORD_LENGTH);
    const checksumValid = computedChecksum === receivedChecksum;
    checksumField.valid = checksumValid;
    if (checksumValid) {
      checksumField.physicalValue = 'Valid';
    } else {
      errors.push({
        code: 'checksum-mismatch',
        message: ERROR_HEADER_CHECKSUM_MISMATCH,
        offset: CHECKSUM_OFFSET,
        length: WORD_LENGTH,
        details: { received: formatHex16(receivedChecksum), computed: formatHex16(computedChecksum) },
      });
    }
  } else {
    // Başlık sınırı (IHL geçersiz ya da tampanda eksik) bilinmiyor — doğrulamayan
    // bir şeyi "yanlış" ilan etmek yanlış pozitiftir (MAVLink crcNeedsDialect emsali).
    checksumField.warnings = [WARN_CHECKSUM_VERIFICATION_SKIPPED];
    warnings.push(toProtocolWarning(WARN_CHECKSUM_VERIFICATION_SKIPPED));
  }
  fields.push(checksumField);

  const sourceBytes = data.slice(SOURCE_ADDRESS_OFFSET, SOURCE_ADDRESS_OFFSET + ADDRESS_LENGTH);
  fields.push({
    id: 'source-address',
    name: 'Source Address',
    offset: SOURCE_ADDRESS_OFFSET,
    length: ADDRESS_LENGTH,
    rawBytes: sourceBytes,
    rawValue: formatIpv4Address(sourceBytes),
    valid: true,
    warnings: [],
  });

  const destinationBytes = data.slice(DESTINATION_ADDRESS_OFFSET, DESTINATION_ADDRESS_OFFSET + ADDRESS_LENGTH);
  fields.push({
    id: 'destination-address',
    name: 'Destination Address',
    offset: DESTINATION_ADDRESS_OFFSET,
    length: ADDRESS_LENGTH,
    rawBytes: destinationBytes,
    rawValue: formatIpv4Address(destinationBytes),
    valid: true,
    warnings: [],
  });

  // Options/Payload: yalnız IHL yapısal olarak geçerli VE tamponda başlığın
  // TAMAMI (options dahil) varsa üretilir — sınırları geçersiz bir değere
  // (declaredHeaderLength) dayandırmak yanlış hizalanmış alanlar üretir.
  if (canVerifyChecksum) {
    if (declaredHeaderLength > MIN_HEADER_LENGTH) {
      const options = data.slice(MIN_HEADER_LENGTH, declaredHeaderLength);
      fields.push({
        id: 'options',
        name: 'Options',
        offset: MIN_HEADER_LENGTH,
        length: options.length,
        rawBytes: options,
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }

    const payload = data.slice(declaredHeaderLength);
    if (payload.length > 0) {
      fields.push({
        id: 'payload',
        name: 'Payload',
        offset: declaredHeaderLength,
        length: payload.length,
        rawBytes: payload,
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
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
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseIpv4(data: Uint8Array): ParseResult {
  return parseIpv4Frame(data, {});
}

function readContextOptions(context: ParseContext | undefined): Ipv4ParseOptions {
  const options: Ipv4ParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const ipv4Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yeterli uzunluk + üst nibble 4. */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_HEADER_LENGTH) return false;
    return (byteAt(data, VERSION_OFFSET) >>> 4) === EXPECTED_VERSION;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseIpv4Frame(data, readContextOptions(context));
  },
};

function ipv4Header(fields: {
  totalLength: number;
  identification: number;
  flagsFragment: number;
  ttl: number;
  protocol: number;
  checksum: number;
  source: readonly [number, number, number, number];
  destination: readonly [number, number, number, number];
  versionIhl?: number;
  dscpEcn?: number;
}): number[] {
  const versionIhl = fields.versionIhl ?? 0x45;
  const dscpEcn = fields.dscpEcn ?? 0x00;
  return [
    versionIhl,
    dscpEcn,
    (fields.totalLength >>> 8) & 0xff,
    fields.totalLength & 0xff,
    (fields.identification >>> 8) & 0xff,
    fields.identification & 0xff,
    (fields.flagsFragment >>> 8) & 0xff,
    fields.flagsFragment & 0xff,
    fields.ttl,
    fields.protocol,
    (fields.checksum >>> 8) & 0xff,
    fields.checksum & 0xff,
    ...fields.source,
    ...fields.destination,
  ];
}

/**
 * Örnek çerçeveler. `classic-tcp-header` ders kitabı/RFC 1071 ailesinden
 * yaygın bilinen bir IPv4 başlığıdır (checksum bağımsız hesapla kanıtlandı,
 * `internetChecksum.test.ts`teki aynı fixture); kalanı bu düzene göre elle
 * kuruldu, checksum'ları görev betiğinde (Node) bağımsız hesaplandı.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'classic-tcp-header',
    name: 'protocol.ipv4.example.classicTcpHeader.name',
    // 45 00 003c 1c46 4000 40 06 b1e6 ac100a63 ac100a0c — checksum bağımsız
    // hesapla 0xB1E6 doğrulandı (internetChecksum.test.ts aynı fixture).
    bytes: Uint8Array.from([
      ...ipv4Header({
        totalLength: 0x003c,
        identification: 0x1c46,
        flagsFragment: 0x4000,
        ttl: 0x40,
        protocol: 6,
        checksum: 0xb1e6,
        source: [172, 16, 10, 99],
        destination: [172, 16, 10, 12],
      }),
      ...Uint8Array.from({ length: 40 }, (_unused, index) => index),
    ]),
    description: 'protocol.ipv4.example.classicTcpHeader.description',
    expectedValid: true,
  },
  {
    id: 'udp-carrying',
    name: 'protocol.ipv4.example.udpCarrying.name',
    // Protocol=17(UDP) → üst katman uyarısı. Checksum 0x5497 bağımsız hesaplandı.
    bytes: Uint8Array.from([
      ...ipv4Header({
        totalLength: 0x0020,
        identification: 0x1234,
        flagsFragment: 0x0000,
        ttl: 64,
        protocol: 17,
        checksum: 0x5497,
        source: [10, 0, 0, 1],
        destination: [10, 0, 0, 2],
      }),
      ...Uint8Array.from({ length: 12 }, (_unused, index) => 0xa0 + index),
    ]),
    description: 'protocol.ipv4.example.udpCarrying.description',
    expectedValid: true,
  },
  {
    id: 'header-checksum-fail',
    name: 'protocol.ipv4.example.headerChecksumFail.name',
    // Checksum bilerek 0x0000 yazıldı; bu başlık için bağımsız hesaplanan
    // gerçek değer 0x66D7'dir (Node, görev betiği) → checksum-mismatch.
    bytes: Uint8Array.from(
      ipv4Header({
        totalLength: 0x0014,
        identification: 0x0000,
        flagsFragment: 0x0000,
        ttl: 64,
        protocol: 17,
        checksum: 0x0000,
        source: [10, 0, 0, 1],
        destination: [10, 0, 0, 2],
      }),
    ),
    description: 'protocol.ipv4.example.headerChecksumFail.description',
    expectedValid: false,
  },
  {
    id: 'unknown-protocol',
    name: 'protocol.ipv4.example.unknownProtocol.name',
    // Protocol=253 (IANA "deneysel kullanım için ayrılmış") dar kümede yok.
    // Checksum 0xF67E bağımsız hesaplandı.
    bytes: Uint8Array.from(
      ipv4Header({
        totalLength: 0x0014,
        identification: 0x0000,
        flagsFragment: 0x0000,
        ttl: 64,
        protocol: 253,
        checksum: 0xf67e,
        source: [192, 168, 1, 10],
        destination: [192, 168, 1, 20],
      }),
    ),
    description: 'protocol.ipv4.example.unknownProtocol.description',
    expectedValid: true,
  },
  {
    id: 'ihl-too-small',
    name: 'protocol.ipv4.example.ihlTooSmall.name',
    // Version/IHL = 0x44 → IHL=4 (16 bayt), minimum 5 (20 bayt) altında —
    // value-out-of-range. Checksum/Options/Payload üretilmez.
    bytes: Uint8Array.from(
      ipv4Header({
        versionIhl: 0x44,
        totalLength: 0x003c,
        identification: 0x1c46,
        flagsFragment: 0x4000,
        ttl: 0x40,
        protocol: 6,
        checksum: 0xb1e6,
        source: [172, 16, 10, 99],
        destination: [172, 16, 10, 12],
      }),
    ),
    description: 'protocol.ipv4.example.ihlTooSmall.description',
    expectedValid: false,
  },
  {
    id: 'total-length-too-small',
    name: 'protocol.ipv4.example.totalLengthTooSmall.name',
    // IHL=5 (20 bayt, geçerli) ama Total Length=16 < 20 → length-mismatch.
    // Checksum 0x66DE bağımsız hesaplandı (bu başlık gövdesi için).
    bytes: Uint8Array.from(
      ipv4Header({
        totalLength: 0x0010,
        identification: 0x0000,
        flagsFragment: 0x0000,
        ttl: 64,
        protocol: 6,
        checksum: 0x66de,
        source: [10, 0, 0, 5],
        destination: [10, 0, 0, 6],
      }),
    ),
    description: 'protocol.ipv4.example.totalLengthTooSmall.description',
    expectedValid: false,
  },
];

export const ipv4Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: ipv4Parser,
  documentation: {
    summary: 'protocol.ipv4.documentation.summary',
    layer: 'network',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
