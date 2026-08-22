/**
 * Ethernet Interface — MDIO/MDC (MII Serial Management Interface) çözümü ve
 * PHY register görüntüleyici. Faz 10 dalga 11k (sıralama önerisi #10).
 *
 * Katalogdaki `ethernet-interface` kaydı MAC↔PHY tarafını anlatır; hattaki
 * Ethernet ÇERÇEVESİ zaten `protocols/network/ethernet/*`ta çözülüyor. Bu
 * sayfanın kendi bayt akışı MDIO yönetim çerçevesidir — spec özetinin
 * (`01-fiziksel-arayuzler.md:392`) "MDIO/MDC Decoder" ve "PHY Register
 * Viewer" istekleri birebir bu.
 *
 * ── Kaynak: İKİ BAĞIMSIZ KAMUYA AÇIK KAYNAKTAN ÇAPRAZ TEYİT ────────────────
 * IEEE 802.3'ün kendisi ücretsiz indirilemedi (ieee802.org GET sayfası 418
 * döndü), bu yüzden BACnet MS/TP CRC'sindeki (dalga 6) disiplin uygulandı:
 *   A. **TI DP83848Q-Q1** veri sayfası (SNLS341C) §5.4.3.2 Table 5-4 —
 *      "MII Management Serial Protocol: <idle><start><op code><device addr>
 *      <reg addr><turnaround><data><idle>", okuma `<01><10>`, yazma
 *      `<01><01>`, 32 bitlik preamble, turnaround kuralı ("no device shall
 *      actively drive the MDIO signal during the first bit of Turnaround;
 *      the addressed PHY drives MDIO with a zero for the second bit").
 *   B. **TI DP83822** veri sayfası — AYNI tabloyu bağımsızca veriyor
 *      ("SMI PROTOCOL <idle><start><op code>…"), ayrıca SMI'nin Clause 22 ve
 *      Clause 45 ile uyumlu olduğunu yazıyor.
 *   C. Register bit tanımları: Linux çekirdeği `include/uapi/linux/mii.h`
 *      (BMCR/BMSR/ADVERTISE/LPA) ile A'daki register tabloları BİT BİT
 *      karşılaştırıldı — ikisi tam örtüştü (BMCR 15 reset … 8 duplex,
 *      BMSR 14..11 yetenekler, 5 AN complete, 2 link status; ANAR/ANLPAR
 *      15 NP, 14 ACK, 13 RF, 10 PAUSE, 8 TX_FD, 7 TX, 6 10_FD, 5 10).
 *      KOD KOPYALANMADI, yalnız bit konumları teyit edildi.
 *
 * ── UYDURULMAYAN ŞEY: Clause 45 op kodları ────────────────────────────────
 * ST alanı `00` olan çerçeve Clause 45'tir (dolaylı adresleme). Elimizdeki
 * üç kaynağın HİÇBİRİ Clause 45'in op kodu tablosunu vermiyor — bu yüzden
 * çözülmüyor: çerçeve "Clause 45" diye adlanır, ham 32 bit gösterilir ve
 * uyarı basılır. Alan uydurmaktansa sınırı göstermek: USB'deki PRE/ERR
 * ayrımı, PMBus ULINEAR16 üssü, LIN break asgarisi ile aynı zincir.
 */

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

const PROTOCOL_ID = 'ethernet-interface';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Ethernet Interface';

const HEX_RADIX = 16;
const FRAME_BYTES = 4;
const PREAMBLE_BYTE = 0xff;
/** Spec: 32 ardışık logic 1 = 4 bayt (A kaynağı §5.4.3.2). */
const PREAMBLE_BYTES = 4;

const ERROR_EMPTY_FRAME = 'protocol.mdio.error.emptyFrame';
const ERROR_ABORTED = 'protocol.mdio.error.aborted';
const ERROR_TRUNCATED = 'protocol.mdio.error.truncated';
const ERROR_INVALID_START = 'protocol.mdio.error.invalidStart';

const WARNING_INVALID_OPCODE = 'protocol.mdio.warning.invalidOpcode';
const WARNING_TURNAROUND = 'protocol.mdio.warning.turnaround';
const WARNING_NO_PHY = 'protocol.mdio.warning.noPhyResponse';
const WARNING_CLAUSE45 = 'protocol.mdio.warning.clause45';
const WARNING_TRAILING = 'protocol.mdio.warning.trailingBytes';
const WARNING_PREAMBLE_SUPPRESSED = 'protocol.mdio.warning.preambleSuppressed';

export type MdioOperation = 'read' | 'write' | 'unknown';

export interface MdioStructure {
  /** Yakalamanın başındaki 0xFF preamble baytları (0 olabilir). */
  preambleBytes: number;
  /** ST alanı: 01 Clause 22, 00 Clause 45. */
  start: number;
  clause22: boolean;
  opcode: number;
  operation: MdioOperation;
  phyAddress: number;
  registerAddress: number;
  turnaround: number;
  data: number;
  /** Çerçevenin yakalama içindeki başlangıç ofseti. */
  frameOffset: number;
  trailingBytes: Uint8Array;
}

/** Clause 22 register adları (kaynak A register tablosu + kaynak C). */
const REGISTER_NAMES: Record<number, string> = {
  0: 'BMCR',
  1: 'BMSR',
  2: 'PHYIDR1',
  3: 'PHYIDR2',
  4: 'ANAR',
  5: 'ANLPAR',
  6: 'ANER',
  7: 'ANNPTR',
  9: 'CTRL1000',
  10: 'STAT1000',
  15: 'ESTATUS',
};

/**
 * Clause 45 MMD (device) numaraları — kaynak C (`linux/mdio.h`). Yalnız
 * ADLANDIRMA için: Clause 45 çerçevesinin kendisi çözülmüyor (dosya başı).
 */
export const MMD_NAMES: Record<number, string> = {
  1: 'PMA/PMD',
  2: 'WIS',
  3: 'PCS',
  4: 'PHY XS',
  5: 'DTE XS',
  6: 'TC',
  7: 'Auto-Negotiation',
  29: 'Clause 22 extension',
  30: 'Vendor Specific 1',
  31: 'Vendor Specific 2',
};

export function formatHexWord(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(4, '0')}`;
}

export function formatBinary(value: number, width: number): string {
  return `0b${value.toString(2).padStart(width, '0')}`;
}

/**
 * Yakalamayı preamble + 32 bitlik çerçeveye ayırır. Preamble opsiyoneldir:
 * kaynak A "preamble suppression" desteğini ayrıca anlatıyor (§5.4.3.3),
 * yani preamble'sız yakalama GEÇERLİDİR — eksikliği uyarı, hata değil.
 */
export function splitMdioFrame(data: Uint8Array): MdioStructure | undefined {
  let preambleBytes = 0;
  while (preambleBytes < data.length && data[preambleBytes] === PREAMBLE_BYTE) preambleBytes += 1;

  // Tamamı 0xFF olan yakalama (ör. hiç cevap vermeyen hat) çerçeve taşımaz;
  // son 4 baytı çerçeve saymak uydurma olurdu.
  if (preambleBytes === data.length) return undefined;
  if (data.length - preambleBytes < FRAME_BYTES) return undefined;

  const offset = preambleBytes;
  const word =
    ((data[offset] ?? 0) << 24) |
    ((data[offset + 1] ?? 0) << 16) |
    ((data[offset + 2] ?? 0) << 8) |
    (data[offset + 3] ?? 0);

  const start = (word >>> 30) & 0x03;
  const opcode = (word >>> 28) & 0x03;
  const operation: MdioOperation = opcode === 0b10 ? 'read' : opcode === 0b01 ? 'write' : 'unknown';

  return {
    preambleBytes,
    start,
    clause22: start === 0b01,
    opcode,
    operation,
    phyAddress: (word >>> 23) & 0x1f,
    registerAddress: (word >>> 18) & 0x1f,
    turnaround: (word >>> 16) & 0x03,
    data: word & 0xffff,
    frameOffset: offset,
    trailingBytes: data.slice(offset + FRAME_BYTES),
  };
}

export interface RegisterFlag {
  name: string;
  bit: number;
  set: boolean;
}

/** BMCR (register 0) — kaynak A tablosu + kaynak C `BMCR_*`. */
function bmcrFlags(value: number): RegisterFlag[] {
  return [
    { name: 'Reset', bit: 15, set: (value & 0x8000) !== 0 },
    { name: 'Loopback', bit: 14, set: (value & 0x4000) !== 0 },
    { name: 'Speed 100 Mb/s', bit: 13, set: (value & 0x2000) !== 0 },
    { name: 'Auto-Negotiation Enable', bit: 12, set: (value & 0x1000) !== 0 },
    { name: 'Power Down', bit: 11, set: (value & 0x0800) !== 0 },
    { name: 'Isolate', bit: 10, set: (value & 0x0400) !== 0 },
    { name: 'Restart Auto-Negotiation', bit: 9, set: (value & 0x0200) !== 0 },
    { name: 'Full Duplex', bit: 8, set: (value & 0x0100) !== 0 },
    { name: 'Collision Test', bit: 7, set: (value & 0x0080) !== 0 },
  ];
}

/** BMSR (register 1). */
function bmsrFlags(value: number): RegisterFlag[] {
  return [
    { name: '100BASE-T4', bit: 15, set: (value & 0x8000) !== 0 },
    { name: '100BASE-TX Full Duplex', bit: 14, set: (value & 0x4000) !== 0 },
    { name: '100BASE-TX Half Duplex', bit: 13, set: (value & 0x2000) !== 0 },
    { name: '10BASE-T Full Duplex', bit: 12, set: (value & 0x1000) !== 0 },
    { name: '10BASE-T Half Duplex', bit: 11, set: (value & 0x0800) !== 0 },
    { name: 'Preamble Suppression', bit: 6, set: (value & 0x0040) !== 0 },
    { name: 'Auto-Negotiation Complete', bit: 5, set: (value & 0x0020) !== 0 },
    { name: 'Remote Fault', bit: 4, set: (value & 0x0010) !== 0 },
    { name: 'Auto-Negotiation Ability', bit: 3, set: (value & 0x0008) !== 0 },
    { name: 'Link Status', bit: 2, set: (value & 0x0004) !== 0 },
    { name: 'Jabber Detect', bit: 1, set: (value & 0x0002) !== 0 },
    { name: 'Extended Capability', bit: 0, set: (value & 0x0001) !== 0 },
  ];
}

/** ANAR (4) ve ANLPAR (5) aynı bit haritasını paylaşır; 14 ACK yalnız ANLPAR'da anlamlı. */
function technologyFlags(value: number, linkPartner: boolean): RegisterFlag[] {
  return [
    { name: 'Next Page', bit: 15, set: (value & 0x8000) !== 0 },
    ...(linkPartner ? [{ name: 'Acknowledge', bit: 14, set: (value & 0x4000) !== 0 }] : []),
    { name: 'Remote Fault', bit: 13, set: (value & 0x2000) !== 0 },
    { name: 'Asymmetric Pause', bit: 11, set: (value & 0x0800) !== 0 },
    { name: 'Pause', bit: 10, set: (value & 0x0400) !== 0 },
    { name: '100BASE-T4', bit: 9, set: (value & 0x0200) !== 0 },
    { name: '100BASE-TX Full Duplex', bit: 8, set: (value & 0x0100) !== 0 },
    { name: '100BASE-TX', bit: 7, set: (value & 0x0080) !== 0 },
    { name: '10BASE-T Full Duplex', bit: 6, set: (value & 0x0040) !== 0 },
    { name: '10BASE-T', bit: 5, set: (value & 0x0020) !== 0 },
  ];
}

export function decodeRegister(register: number, value: number): RegisterFlag[] {
  switch (register) {
    case 0:
      return bmcrFlags(value);
    case 1:
      return bmsrFlags(value);
    case 4:
      return technologyFlags(value, false);
    case 5:
      return technologyFlags(value, true);
    default:
      return [];
  }
}

/**
 * Spec özetinin istediği tek satırlık link tablosu ("Link UP, Speed 100 Mbps,
 * Duplex Full, Auto-negotiation Complete, Partner 10/100 capable"). Yalnız
 * register'ın KENDİ taşıdığı bilgiden üretilir: BMSR link/AN durumu verir ama
 * çalışan HIZI vermez (o BMCR'de ya da satıcıya özel register'da), bu yüzden
 * BMSR satırında hız YAZILMAZ — yetenek ile çalışan hız karıştırılmaz.
 */
export function summariseRegister(register: number, value: number): string | undefined {
  if (register === 1) {
    const link = (value & 0x0004) !== 0 ? 'Link UP' : 'Link DOWN';
    const negotiation = (value & 0x0020) !== 0 ? 'Auto-Negotiation complete' : 'Auto-Negotiation pending';
    return `${link} · ${negotiation}`;
  }
  if (register === 0) {
    const speed = (value & 0x2000) !== 0 ? '100 Mb/s' : '10 Mb/s';
    const duplex = (value & 0x0100) !== 0 ? 'Full duplex' : 'Half duplex';
    const auto = (value & 0x1000) !== 0 ? 'Auto-Negotiation enabled' : 'forced';
    // AN açıkken hız/duplex bitleri YOK SAYILIR (kaynak A: "bits 8 and 13 of
    // this register are ignored when this bit is set") — gizlenmez, yazılır.
    return (value & 0x1000) !== 0 ? `${auto} (speed/duplex bits ignored)` : `${speed} · ${duplex} · ${auto}`;
  }
  if (register === 4 || register === 5) {
    const fast = (value & 0x0180) !== 0;
    const slow = (value & 0x0060) !== 0;
    const capability = fast && slow ? '10/100 capable' : fast ? '100 capable' : slow ? '10 capable' : 'no technology advertised';
    return register === 5 ? `Partner ${capability}` : `Advertising ${capability}`;
  }
  return undefined;
}

export type MdioFrameMetadata = {
  clause: string;
  operation: MdioOperation;
  phyAddress: number;
  registerAddress: number;
  registerName?: string;
  data: string;
  summary?: string;
  phyResponded?: boolean;
};

interface MdioParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function parseMdio(data: Uint8Array, options: MdioParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY_FRAME, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const structure = splitMdioFrame(data);
  if (structure === undefined) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_TRUNCATED,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: FRAME_BYTES },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];
  const fields: ParsedField[] = [];
  const base = structure.frameOffset;

  if (structure.preambleBytes > 0) {
    fields.push({
      id: 'preamble',
      name: 'Preamble',
      offset: 0,
      length: structure.preambleBytes,
      rawBytes: data.slice(0, structure.preambleBytes),
      physicalValue: `${structure.preambleBytes * 8} × 1`,
      valid: true,
      warnings: [],
    });
    if (structure.preambleBytes !== PREAMBLE_BYTES) {
      warnings.push({
        code: 'preamble-length',
        message: WARNING_PREAMBLE_SUPPRESSED,
        offset: 0,
        length: structure.preambleBytes,
      });
    }
  } else {
    // Kaynak A §5.4.3.3: preamble suppression desteklenir — eksikliği hata değil.
    warnings.push({ code: 'preamble-suppressed', message: WARNING_PREAMBLE_SUPPRESSED, offset: 0, length: 0 });
  }

  const startLabel = structure.clause22 ? 'Clause 22' : structure.start === 0b00 ? 'Clause 45' : 'invalid';
  fields.push({
    id: 'start',
    name: 'ST',
    offset: base,
    length: 1,
    rawBytes: data.slice(base, base + 1),
    rawValue: structure.start,
    physicalValue: `${formatBinary(structure.start, 2)} · ${startLabel}`,
    valid: structure.clause22 || structure.start === 0b00,
    warnings: [],
  });

  if (!structure.clause22) {
    // Clause 45 çerçevesi: op kodu tablosu elimizdeki kaynaklarda YOK, alan
    // uydurulmuyor (dosya başı). Ham 32 bit tek alan olarak gösterilir.
    if (structure.start === 0b00) {
      warnings.push({ code: 'clause-45', message: WARNING_CLAUSE45, offset: base, length: FRAME_BYTES });
      fields.push({
        id: 'clause45Frame',
        name: 'Clause 45 Frame',
        offset: base,
        length: FRAME_BYTES,
        rawBytes: data.slice(base, base + FRAME_BYTES),
        physicalValue: 'not decoded',
        valid: true,
        warnings: [],
      });
    } else {
      errors.push({
        code: 'start-delimiter-not-found',
        message: ERROR_INVALID_START,
        offset: base,
        length: 1,
        details: { start: structure.start },
      });
    }
  } else {
    const operationLabel =
      structure.operation === 'unknown'
        ? formatBinary(structure.opcode, 2)
        : `${formatBinary(structure.opcode, 2)} · ${structure.operation === 'read' ? 'Read' : 'Write'}`;

    fields.push(
      {
        id: 'opcode',
        name: 'OP',
        offset: base,
        length: 1,
        rawBytes: data.slice(base, base + 1),
        rawValue: structure.opcode,
        physicalValue: operationLabel,
        valid: structure.operation !== 'unknown',
        warnings: [],
      },
      {
        id: 'phyAddress',
        name: 'PHYAD',
        offset: base,
        length: 2,
        rawBytes: data.slice(base, base + 2),
        rawValue: structure.phyAddress,
        physicalValue: `${structure.phyAddress}`,
        valid: true,
        warnings: [],
      },
      {
        id: 'registerAddress',
        name: 'REGAD',
        offset: base + 1,
        length: 2,
        rawBytes: data.slice(base + 1, base + 3),
        rawValue: structure.registerAddress,
        physicalValue:
          REGISTER_NAMES[structure.registerAddress] === undefined
            ? `${structure.registerAddress}`
            : `${structure.registerAddress} · ${REGISTER_NAMES[structure.registerAddress] ?? ''}`,
        valid: true,
        warnings: [],
      },
      {
        id: 'turnaround',
        name: 'TA',
        offset: base + 2,
        length: 1,
        rawBytes: data.slice(base + 2, base + 3),
        rawValue: structure.turnaround,
        physicalValue: formatBinary(structure.turnaround, 2),
        valid: structure.turnaround === 0b10,
        warnings: [],
      },
    );

    if (structure.operation === 'unknown') {
      warnings.push({ code: 'invalid-opcode', message: WARNING_INVALID_OPCODE, offset: base, length: 1 });
    }

    // Kaynak A: TA'nın ikinci biti okuma işleminde ADRESLENEN PHY tarafından
    // 0'a çekilir. 1 kalmışsa kimse cevap vermemiştir — spec özetinin
    // "PHY not detected / Wrong PHY address" entegrasyon hatasının tam izi.
    const noResponse = structure.operation === 'read' && structure.turnaround === 0b11;
    if (noResponse) {
      warnings.push({ code: 'no-phy-response', message: WARNING_NO_PHY, offset: base + 2, length: 2 });
    } else if (structure.turnaround !== 0b10) {
      warnings.push({ code: 'turnaround', message: WARNING_TURNAROUND, offset: base + 2, length: 1 });
    }

    const registerName = REGISTER_NAMES[structure.registerAddress];
    // **Cevapsız okumada veri ÇÖZÜLMEZ.** Hat pull-up ile yüksek kaldığı için
    // 16 bit 0xFFFF okunur; bunu register içeriği sanıp "Link UP, AN complete,
    // her yetenek var" diye basmak kullanıcıyı yanlış yöne sokardı — üstelik
    // gerçek durum tam tersi (o adreste PHY yok). Tarayıcı turunda yakalandı.
    const summary = noResponse ? undefined : summariseRegister(structure.registerAddress, structure.data);
    fields.push({
      id: 'data',
      name: 'DATA',
      offset: base + 2,
      length: 2,
      rawBytes: data.slice(base + 2, base + FRAME_BYTES),
      rawValue: structure.data,
      physicalValue: noResponse
        ? `${formatHexWord(structure.data)} · no response`
        : summary === undefined
          ? formatHexWord(structure.data)
          : `${formatHexWord(structure.data)} · ${summary}`,
      valid: !noResponse,
      warnings: [],
    });

    for (const flag of noResponse ? [] : decodeRegister(structure.registerAddress, structure.data)) {
      fields.push({
        id: `${(registerName ?? 'reg').toLowerCase()}.${flag.bit}`,
        name: `${registerName ?? 'Register'} · ${flag.name}`,
        offset: base + 2,
        length: 2,
        rawBytes: data.slice(base + 2, base + FRAME_BYTES),
        // Ham değer sütununda BİT NUMARASI değil bitin DEĞERİ durur — numara
        // zaten adın yanında yazılı, sütuna konsa "0xF (15)" diye okunup
        // register değeri sanılırdı (tarayıcı turunda yakalandı).
        rawValue: flag.set ? 1 : 0,
        physicalValue: `bit ${flag.bit} · ${flag.set ? 'set' : 'clear'}`,
        valid: true,
        warnings: [],
      });
    }
  }

  if (structure.trailingBytes.length > 0) {
    const offset = data.length - structure.trailingBytes.length;
    fields.push({
      id: 'trailing',
      name: 'Unassigned Bytes',
      offset,
      length: structure.trailingBytes.length,
      rawBytes: structure.trailingBytes,
      unit: 'B',
      valid: false,
      warnings: [],
    });
    warnings.push({
      code: 'trailing-bytes',
      message: WARNING_TRAILING,
      offset,
      length: structure.trailingBytes.length,
    });
  }

  const registerName = REGISTER_NAMES[structure.registerAddress];
  const phyResponded = !(structure.operation === 'read' && structure.turnaround === 0b11);
  const summary =
    structure.clause22 && phyResponded
      ? summariseRegister(structure.registerAddress, structure.data)
      : undefined;
  const metadata: MdioFrameMetadata = {
    clause: structure.clause22 ? 'clause-22' : 'clause-45',
    operation: structure.operation,
    phyAddress: structure.phyAddress,
    registerAddress: structure.registerAddress,
    ...(registerName === undefined ? {} : { registerName }),
    data: formatHexWord(structure.data),
    ...(summary === undefined ? {} : { summary }),
    ...(structure.operation === 'read' ? { phyResponded } : {}),
  };

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata,
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: fields.sort((left, right) => left.offset - right.offset),
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseMdioFrame(data: Uint8Array): ParseResult {
  return parseMdio(data, {});
}

export const mdioParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Çerçeve 32 bit; preamble opsiyonel olduğu için asgari 4 bayt aranır. */
  canParse(data: Uint8Array): boolean {
    return splitMdioFrame(data) !== undefined;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: MdioParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseMdio(data, options);
  },
};

/**
 * Çerçeve kurucu — örnekler ve testler için. Bitler hatta MSb-first gider,
 * bu yüzden 32 bitlik kelime big-endian dört bayta yazılır.
 */
export function buildMdioFrame(input: {
  preamble?: boolean;
  start?: number;
  opcode: number;
  phyAddress: number;
  registerAddress: number;
  turnaround: number;
  data: number;
}): Uint8Array {
  const word =
    (((input.start ?? 0b01) & 0x03) << 30) |
    ((input.opcode & 0x03) << 28) |
    ((input.phyAddress & 0x1f) << 23) |
    ((input.registerAddress & 0x1f) << 18) |
    ((input.turnaround & 0x03) << 16) |
    (input.data & 0xffff);

  const frame = [
    (word >>> 24) & 0xff,
    (word >>> 16) & 0xff,
    (word >>> 8) & 0xff,
    word & 0xff,
  ];

  return Uint8Array.from(
    input.preamble === false ? frame : [...new Array<number>(PREAMBLE_BYTES).fill(PREAMBLE_BYTE), ...frame],
  );
}

/**
 * Örnek çerçeveler. Register değerleri kaynak A'nın kendi reset/örnek
 * değerlerinden ve spec özetinin link tablosundan seçildi:
 * BMSR 0x782D (10/100 yetenekli, AN tamam, link UP), BMCR 0x3100
 * (AN etkin + 100 Mb/s + full duplex bitleri), ANLPAR 0x45E1 (partner
 * 10/100 capable — spec özetinin "Partner 10/100 capable" satırı).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'read-bmsr',
    name: 'protocol.mdio.example.readBmsr.name',
    bytes: buildMdioFrame({ opcode: 0b10, phyAddress: 1, registerAddress: 1, turnaround: 0b10, data: 0x782d }),
    description: 'protocol.mdio.example.readBmsr.description',
    expectedValid: true,
  },
  {
    id: 'write-bmcr',
    name: 'protocol.mdio.example.writeBmcr.name',
    bytes: buildMdioFrame({ opcode: 0b01, phyAddress: 1, registerAddress: 0, turnaround: 0b10, data: 0x3100 }),
    description: 'protocol.mdio.example.writeBmcr.description',
    expectedValid: true,
  },
  {
    id: 'read-anlpar',
    name: 'protocol.mdio.example.readAnlpar.name',
    bytes: buildMdioFrame({ opcode: 0b10, phyAddress: 1, registerAddress: 5, turnaround: 0b10, data: 0x45e1 }),
    description: 'protocol.mdio.example.readAnlpar.description',
    expectedValid: true,
  },
  {
    id: 'no-phy',
    name: 'protocol.mdio.example.noPhy.name',
    // Cevapsız okuma: TA'nın ikinci biti 1 kalır, veri pull-up yüzünden 0xFFFF.
    bytes: buildMdioFrame({ opcode: 0b10, phyAddress: 7, registerAddress: 1, turnaround: 0b11, data: 0xffff }),
    description: 'protocol.mdio.example.noPhy.description',
    expectedValid: true,
  },
  {
    id: 'preamble-suppressed',
    name: 'protocol.mdio.example.preambleSuppressed.name',
    bytes: buildMdioFrame({
      preamble: false,
      opcode: 0b10,
      phyAddress: 1,
      registerAddress: 0,
      turnaround: 0b10,
      data: 0x1000,
    }),
    description: 'protocol.mdio.example.preambleSuppressed.description',
    expectedValid: true,
  },
  {
    id: 'clause-45',
    name: 'protocol.mdio.example.clause45.name',
    // ST=00: PLCA register alanı (MMD 31, Vendor Specific 2) bu yolla okunur.
    bytes: buildMdioFrame({ start: 0b00, opcode: 0b11, phyAddress: 1, registerAddress: 31, turnaround: 0b10, data: 0xca04 }),
    description: 'protocol.mdio.example.clause45.description',
    expectedValid: true,
  },
];

export const mdioPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: mdioParser,
  documentation: {
    summary: 'protocol.mdio.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
