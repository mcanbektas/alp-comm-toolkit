/**
 * EtherCAT (ETG.1000 serisi / IEC 61158) — "uçarken işlenen" endüstriyel
 * Ethernet fieldbus'ı. Girdi TAM BİR ETHERNET ÇERÇEVESİdir: DST MAC + SRC MAC
 * (+ opsiyonel VLAN tag'leri) + EtherType 0x88A4 + EtherCAT başlığı + datagram
 * zinciri (+ Ethernet dolgusu).
 *
 * ── GİRDİ MODELİ (Karar 5, brief-faz10-dalga5.md satır 284-290) ──────────────
 * Bu, dalga 1/4'ün "motorlar zincir KURMAZ" kararının bir istisnası DEĞİLDİR:
 * EtherCAT, Ethernet'in ÜSTÜNDE taşınan bir üst katman değil, çerçevenin
 * kendisidir — IP/UDP kapsüllemesi yok, EtherType doğrudan EtherCAT'i işaret
 * ediyor. Bu yüzden Ethernet başlık alanları da bu motorun alanlarıdır ve
 * çözümleri `network/ethernet/ethernetFrame.ts`nin (dalga 4a) DIŞA AÇILAN
 * yardımcılarıyla yapılır: `formatMac`, `classifyDestinationMac` ve
 * `walkTypeLengthChain` (VLAN TPID/TCI yürüyüşü). İkinci bir MAC formatlayıcı
 * ya da ikinci bir VLAN döngüsü yazılmadı — iki farklı davranış demek olurdu.
 * `ethernet-ii` sayfası ise 0x88A4'ü yalnız ADLANDIRIR ve buraya yönlendirir
 * (`ETHER_TYPE_NAMES`, dalga 5d'de eklendi).
 *
 * ── KAYNAK UYARISI (Karar 2, brief-faz10-dalga5.md) ─────────────────────────
 * ETG.1000 serisinin resmi metni kayıt/lisans şartlıdır ve bu depoda YOK.
 * Aşağıdaki bit yerleşimleri, bayt genişlikleri ve komut kümesi ÜÇ bağımsız,
 * kamuya açık ikincil kaynaktan ÇAPRAZ TEYİTLE alındı (üçüne de bu oturumda
 * gerçekten erişildi; KOD KOPYALANMADI, yalnız format bilgisi doğrulandı):
 *   1. **Wireshark EtherCAT eklentisi** — dosyaların telif satırı
 *      "Copyright (c) 2007 by Beckhoff Automation GmbH", yani protokolü
 *      tanımlayan firmanın kendi yayımladığı alan tanımı (GPL-2.0-or-later):
 *      `plugins/epan/ethercat/packet-ethercat-frame.h` çerçeve başlığını
 *      `length:11 / reserved:1 / protocol:4` bit alanı olarak verir; `.c`
 *      dosyası maskeleri açıkça yazar (0x07FF / 0x0800 / 0xF000).
 *      `packet-ethercat-datagram.h` datagram başlığını `cmd(1) idx(1)
 *      adp(2)+ado(2) len(2) intr(2)` = 10 bayt olarak verir; `.c` dosyası
 *      len sözcüğünün maskelerini (0x07FF uzunluk, 0x3800 reserved, 0x4000
 *      round trip/circulating, 0x8000 "more") ve Working Counter'ın
 *      `offset + 10 + len` konumunda 2 bayt LITTLE-ENDIAN okunduğunu gösterir.
 *      https://github.com/wireshark/wireshark/tree/master/plugins/epan/ethercat
 *   2. **IgH EtherCAT Master** (Ingenieurgemeinschaft IgH, GPLv2 — yalnız
 *      dokümante edilmiş sabitler referans alındı): `master/globals.h`
 *      `EC_FRAME_HEADER_SIZE 2`, `EC_DATAGRAM_HEADER_SIZE 10`,
 *      `EC_DATAGRAM_FOOTER_SIZE 2` (footer = WKC, VERİDEN SONRA);
 *      `master/master.c` çerçeve başlığını `((size - 2) & 0x7FF) | 0x1000`
 *      olarak KURAR (Type=1 bit 12-15'te) ve zinciri
 *      `EC_READ_U16(cur_data + 6) & 0x8000` ile yürür (len sözcüğü datagram
 *      içinde ofset 6'da, "more" biti 0x8000); `master/datagram.h` komut
 *      numaralarını 0x00-0x0E aralığında verir.
 *   3. **SOEM** (OpenEtherCATsociety) `soem/ethercattype.h` (v1.4.0):
 *      `EC_CMD_NOP = 0x00` başlayıp APRD…FRMW ile ardışık ilerleyen aynı
 *      komut kümesi; `EC_MAXLRWDATA (EC_MAXECATFRAME - 14 - 2 - 10 - 2 - 4)`
 *      ifadesi bayt bütçesini bağımsız olarak doğrular: 14 Ethernet başlığı,
 *      2 EtherCAT başlığı, 10 datagram başlığı, 2 WKC, 4 FCS.
 * Wireshark'ın Beckhoff imzalı dosyası ayrıca kamuya açık ESC datasheet'ini
 * (Section I — Technology) kaynak gösterir; o PDF'e doğrudan HTTP erişimi bu
 * oturumda 403 döndü, bu yüzden hiçbir alan TEK BAŞINA ona dayandırılmadı.
 *
 * TEYİT EDİLEMEYEN ADLANDIRILMADI: komut 0xFF ("EXT") yalnız Wireshark'ta
 * geçiyor, IgH ve SOEM'in kümesinde YOK — bu yüzden ham bırakıldı ve
 * `WARN_UNKNOWN_COMMAND` ile işaretlenir (uydurma yasağı, spec 7259).
 *
 * ── STATUS: 'ready' — GEREKÇE ───────────────────────────────────────────────
 * Ham kalan tek bölge datagram VERİSİdir ve bu YAPISAL bir eksik değil,
 * tanım-bağımlı içeriktir: bir datagramın verisi ya PDO eşlemesine (slave
 * konfigürasyonu) ya da ESC register haritasına göre anlam kazanır; tek bir
 * çerçeveden çıkarılamaz. Emsal karşılaştırması:
 *   • MAVLink 'partial' — çünkü protokolün KENDİ tanımladığı bir DOĞRULAMA
 *     (CRC_EXTRA'lı checksum) dialect olmadan yapılamıyor; eksik olan şey
 *     yapının bir parçası.
 *   • TCP/UDP 'ready' — her başlık alanı adlandırıldı, payload ham; yapılmayan
 *     doğrulama yok, çünkü girdinin doğası gereği yok.
 * EtherCAT ikinci gruba düşer: çerçeve başlığı, datagram başlığının HER alanı
 * (komut, index, adresleme kipine göre bölünmüş adres, 11-bit uzunluk + üç
 * bayrak, IRQ) ve Working Counter adlandırılıp çözülür; zincir sonuna kadar
 * yürünür. EtherCAT'in kendi tanımladığı bir çerçeve checksum'ı YOKTUR (o iş
 * Ethernet FCS'inindir) — dolayısıyla atlanan bir doğrulama da yoktur. WKC bir
 * checksum değil SAYAÇtır; beklenen değeri topolojiye bağlıdır ve tek
 * çerçeveden hesaplanamaz, bu yüzden MAVLink emsalindeki gibi ham gösterilir,
 * MISMATCH ASLA BASILMAZ.
 *
 * ── ANALYZER SINIRI ─────────────────────────────────────────────────────────
 * Slave state machine zaman çizelgesi (spec 7311-7349), distributed clocks
 * kayma analizi ve mailbox (CoE/FoE/EoE/SoE) oturumu bu motorun DIŞINDADIR —
 * çok çerçeve ister. Bu motor tek çerçevenin alanlarını verir.
 *
 * ── ENDIANNESS TUZAĞI ───────────────────────────────────────────────────────
 * Ethernet başlığı NETWORK ORDER (big-endian) okunur; EtherCAT başlığından
 * itibaren HER ŞEY LITTLE-ENDIAN'dır. Geçiş noktası EtherType alanının hemen
 * sonrasıdır ve iki okuma yardımcısı bilerek ayrı adlandırıldı.
 */

import {
  MAC_LENGTH,
  MIN_HEADER_LENGTH,
  TYPE_LENGTH_FIELD_LENGTH,
  VLAN_TPID,
  classifyDestinationMac,
  formatMac,
  walkTypeLengthChain,
} from '@/protocols/network/ethernet/ethernetFrame';
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

/** Katalogdaki kayıt id'siyle birebir aynı olmalı (`src/app/catalog`, plugin bağı budur). */
const PROTOCOL_ID = 'ethercat';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'EtherCAT';

/** EtherCAT'in tel üstündeki tek kimliği (Wireshark `ETHERTYPE_ECATF`). */
const ETHERCAT_ETHER_TYPE = 0x88a4;

/** EtherCAT çerçeve başlığı: tek bir 16-bit LE sözcük (IgH `EC_FRAME_HEADER_SIZE`). */
const ECAT_HEADER_LENGTH = 2;
/** Datagram başlığı: cmd(1)+idx(1)+adres(4)+len(2)+irq(2) (IgH `EC_DATAGRAM_HEADER_SIZE`). */
const DATAGRAM_HEADER_LENGTH = 10;
/** Working Counter datagramın SONUNDA, veriden SONRA (IgH `EC_DATAGRAM_FOOTER_SIZE`). */
const WORKING_COUNTER_LENGTH = 2;
/** Veri sıfır bayt olsa bile bir datagram en az bu kadar yer kaplar. */
const MIN_DATAGRAM_LENGTH = DATAGRAM_HEADER_LENGTH + WORKING_COUNTER_LENGTH;

/** Çerçeve başlığı bit maskeleri — üç kaynakta da aynı (dosya başı). */
const FRAME_LENGTH_MASK = 0x07ff;
const FRAME_RESERVED_MASK = 0x0800;
const FRAME_TYPE_MASK = 0xf000;
const FRAME_TYPE_SHIFT = 12;
/** Type=1: gövde EtherCAT komut/datagram zinciridir. Diğer değerler ham kalır. */
const FRAME_TYPE_COMMANDS = 1;

/** Datagram len sözcüğü bit maskeleri — Wireshark `hf_ecat_length_*` ile birebir. */
const DATAGRAM_LENGTH_MASK = 0x07ff;
const DATAGRAM_RESERVED_MASK = 0x3800;
const DATAGRAM_CIRCULATING_MASK = 0x4000;
const DATAGRAM_MORE_MASK = 0x8000;

/**
 * Sonsuz döngü koruması. 11-bit çerçeve uzunluğu en fazla 2047 bayt datagram
 * bölgesi tarif edebilir; en küçük datagram 12 bayttır → fiziksel üst sınır
 * 170. Bu sayı onun ÜSTÜNDE seçildi: sağlam bir çerçevede asla tetiklenmez,
 * yalnız bozuk/çelişkili girdide devreye girer (IPv6 ext-header emsali).
 */
const MAX_DATAGRAMS = 256;

const HEX_RADIX = 16;
/** VLAN'lı varyantta tip alanı bir tag kadar ilerideki ofsettedir. */
const VLAN_TAG_LENGTH = 4;

export const ERROR_FRAME_TOO_SHORT = 'protocol.ethercat.error.frameTooShort';
export const ERROR_FRAME_TOO_LONG = 'protocol.ethercat.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.ethercat.error.aborted';
export const ERROR_ETHER_TYPE_NOT_ETHERCAT = 'protocol.ethercat.error.etherTypeNotEtherCat';
export const ERROR_HEADER_TRUNCATED = 'protocol.ethercat.error.headerTruncated';
export const ERROR_DATAGRAM_REGION_TRUNCATED = 'protocol.ethercat.error.datagramRegionTruncated';
export const ERROR_DATAGRAM_HEADER_TRUNCATED = 'protocol.ethercat.error.datagramHeaderTruncated';
export const ERROR_DATAGRAM_BODY_TRUNCATED = 'protocol.ethercat.error.datagramBodyTruncated';

export const WARN_FRAME_RESERVED_BIT_SET = 'protocol.ethercat.warning.frameReservedBitSet';
export const WARN_NON_COMMAND_TYPE = 'protocol.ethercat.warning.nonCommandType';
export const WARN_UNKNOWN_COMMAND = 'protocol.ethercat.warning.unknownCommand';
export const WARN_DATAGRAM_RESERVED_BITS_SET = 'protocol.ethercat.warning.datagramReservedBitsSet';
export const WARN_PROCESS_DATA_NEEDS_CONFIGURATION =
  'protocol.ethercat.warning.processDataNeedsConfiguration';
export const WARN_WORKING_COUNTER_NOT_VERIFIABLE =
  'protocol.ethercat.warning.workingCounterNotVerifiable';
export const WARN_DECLARED_LENGTH_MISMATCH = 'protocol.ethercat.warning.declaredLengthMismatch';
export const WARN_MORE_FLAG_WITHOUT_ROOM = 'protocol.ethercat.warning.moreFlagWithoutRoom';
export const WARN_DATAGRAM_LIMIT_REACHED = 'protocol.ethercat.warning.datagramLimitReached';
export const WARN_PADDING_NOT_ZERO = 'protocol.ethercat.warning.paddingNotZero';

const SUMMARY_COMMAND_FRAME = 'protocol.ethercat.summary.commandFrame';
const SUMMARY_NON_COMMAND_TYPE = 'protocol.ethercat.summary.nonCommandType';
const SUMMARY_NOT_ETHERCAT = 'protocol.ethercat.summary.notEtherCat';

/**
 * Adresleme kipi, komuttan TÜRETİLİR — adres alanının 4 baytının nasıl
 * BÖLÜNECEĞİNİ belirleyen tek şey budur (Wireshark'ın `switch(cmd)` dalı ve
 * IgH'nin komut sınıflaması aynı bölmeyi veriyor):
 *   `logical`  → tek bir 32-bit logical address (LRD/LWR/LRW)
 *   `position` → ADP auto-increment sayacı + ADO register ofseti
 *   `node`     → ADP configured station address + ADO register ofseti
 *   `broadcast`→ ADP konum sayacı + ADO register ofseti
 *   `unknown`  → komut teyitli kümede değil; 4 bayt HAM bırakılır
 */
type AddressingMode = 'logical' | 'position' | 'node' | 'broadcast' | 'unknown';

interface CommandDefinition {
  readonly short: string;
  readonly long: string;
  readonly addressing: AddressingMode;
}

/**
 * Komut kümesi — ÜÇ kaynakta da (Wireshark `EcCmdShort`/`EcCmdLong`, IgH
 * `ec_datagram_type_t`, SOEM `EC_CMD_*`) aynı numara aynı kısaltmayla geçiyor.
 * 0xFF ("EXT") yalnız Wireshark'ta var → BURAYA GİRMEZ, ham kalır.
 */
const COMMANDS: ReadonlyMap<number, CommandDefinition> = new Map<number, CommandDefinition>([
  [0x00, { short: 'NOP', long: 'No Operation', addressing: 'position' }],
  [0x01, { short: 'APRD', long: 'Auto Increment Physical Read', addressing: 'position' }],
  [0x02, { short: 'APWR', long: 'Auto Increment Physical Write', addressing: 'position' }],
  [0x03, { short: 'APRW', long: 'Auto Increment Physical ReadWrite', addressing: 'position' }],
  [0x04, { short: 'FPRD', long: 'Configured Address Physical Read', addressing: 'node' }],
  [0x05, { short: 'FPWR', long: 'Configured Address Physical Write', addressing: 'node' }],
  [0x06, { short: 'FPRW', long: 'Configured Address Physical ReadWrite', addressing: 'node' }],
  [0x07, { short: 'BRD', long: 'Broadcast Read', addressing: 'broadcast' }],
  [0x08, { short: 'BWR', long: 'Broadcast Write', addressing: 'broadcast' }],
  [0x09, { short: 'BRW', long: 'Broadcast ReadWrite', addressing: 'broadcast' }],
  [0x0a, { short: 'LRD', long: 'Logical Read', addressing: 'logical' }],
  [0x0b, { short: 'LWR', long: 'Logical Write', addressing: 'logical' }],
  [0x0c, { short: 'LRW', long: 'Logical ReadWrite', addressing: 'logical' }],
  [
    0x0d,
    { short: 'ARMW', long: 'Auto Increment Physical Read Multiple Write', addressing: 'position' },
  ],
  [
    0x0e,
    {
      short: 'FRMW',
      long: 'Configured Address Physical Read Multiple Write',
      addressing: 'node',
    },
  ],
]);

/**
 * Çerçeve başlığı Type alanının dar ad kümesi. Yalnız 1 ÇÖZÜLÜR; kalanlar
 * adlandırılır ama gövdeleri ham kalır (mailbox/ADS içerikleri ayrı iş).
 */
const FRAME_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'EtherCAT commands'],
  [4, 'Network Variables'],
  [5, 'Mailbox'],
]);

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** Ethernet başlığının okuma düzeni — network order. */
function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

/** EtherCAT başlığından itibaren HER alanın okuma düzeni — little-endian. */
function readUint16LE(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

/** `>>> 0`: 32-bit logical address'in en üst biti işaretli sayıya kaymasın. */
function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    (byteAt(data, offset) |
      (byteAt(data, offset + 1) << 8) |
      (byteAt(data, offset + 2) << 16) |
      (byteAt(data, offset + 3) << 24)) >>>
    0
  );
}

function formatHex(value: number, digits: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(digits, '0')}`;
}

interface FailureInit {
  readonly code: ProtocolErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly offset?: number;
  readonly length?: number;
  readonly details?: Record<string, unknown>;
}

function fail(init: FailureInit): ParseResult {
  const error: ProtocolError = { code: init.code, message: init.message };
  if (init.offset !== undefined) error.offset = init.offset;
  if (init.length !== undefined) error.length = init.length;
  if (init.details !== undefined) error.details = init.details;
  return { success: false, error, consumedBytes: 0, recoverable: init.recoverable };
}

export type EtherCatFrameMetadata = {
  /** Çerçeve başlığındaki Type alanı; EtherType yanlışsa `undefined`. */
  frameType: number | undefined;
  datagramCount: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface EtherCatParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

/**
 * Frame düzeyindeki uyarıları TEKRARSIZ biriktirir: aynı not (ör. "process
 * data konfigürasyon ister") her datagramda alan düzeyinde basılır ama frame
 * rozetinde bir kez görünmelidir.
 */
class WarningSink {
  private readonly seen = new Set<string>();
  readonly warnings: ProtocolWarning[] = [];

  push(key: string): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.warnings.push(toProtocolWarning(key));
  }
}

interface DatagramOutcome {
  /** Bu datagramın tükettiği toplam bayt (başlık + veri + WKC). */
  readonly consumed: number;
  readonly more: boolean;
  readonly commandLabel: string;
}

/**
 * TEK bir datagramı çözer. `offset` datagram başlığının ilk baytıdır; `limit`
 * datagram bölgesinin (çerçeve başlığındaki Length'in tarif ettiği aralığın)
 * bittiği yerdir. Fırlatmaz: yer yetmezse hata basıp `consumed: 0` döner ve
 * çağıran zinciri durdurur.
 */
function decodeDatagram(
  data: Uint8Array,
  offset: number,
  limit: number,
  index: number,
  fields: ParsedField[],
  warnings: WarningSink,
  errors: ProtocolError[],
): DatagramOutcome | undefined {
  const prefix = `datagram-${String(index)}`;
  const label = `Datagram #${String(index + 1)}`;

  if (limit - offset < DATAGRAM_HEADER_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_DATAGRAM_HEADER_TRUNCATED,
      offset,
      length: Math.max(0, limit - offset),
    });
    return undefined;
  }

  const command = byteAt(data, offset);
  const definition = COMMANDS.get(command);
  const commandField: ParsedField = {
    id: `${prefix}-command`,
    name: `${label} — Cmd`,
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: command,
    valid: definition !== undefined,
    warnings: [],
  };
  if (definition === undefined) {
    // Teyit edilemeyen kod ADLANDIRILMAZ (0xFF/EXT dahil, dosya başı).
    commandField.warnings.push(WARN_UNKNOWN_COMMAND);
    warnings.push(WARN_UNKNOWN_COMMAND);
  } else {
    commandField.physicalValue = `${definition.short} — ${definition.long}`;
  }
  fields.push(commandField);

  fields.push({
    id: `${prefix}-index`,
    name: `${label} — Idx`,
    offset: offset + 1,
    length: 1,
    rawBytes: data.slice(offset + 1, offset + 2),
    rawValue: byteAt(data, offset + 1),
    valid: true,
    warnings: [],
  });

  const addressOffset = offset + 2;
  const addressing: AddressingMode = definition?.addressing ?? 'unknown';
  if (addressing === 'logical') {
    // LRD/LWR/LRW: 4 bayt TEK bir logical address'tir, ADP/ADO diye bölünmez.
    const logicalAddress = readUint32LE(data, addressOffset);
    fields.push({
      id: `${prefix}-logical-address`,
      name: `${label} — Logical Address`,
      offset: addressOffset,
      length: 4,
      rawBytes: data.slice(addressOffset, addressOffset + 4),
      rawValue: logicalAddress,
      physicalValue: formatHex(logicalAddress, 8),
      valid: true,
      warnings: [],
    });
  } else if (addressing === 'unknown') {
    // Komut bilinmiyorsa adresin NASIL bölüneceği de bilinmiyor — ham kalır.
    fields.push({
      id: `${prefix}-address`,
      name: `${label} — Address`,
      offset: addressOffset,
      length: 4,
      rawBytes: data.slice(addressOffset, addressOffset + 4),
      unit: 'B',
      valid: false,
      warnings: [WARN_UNKNOWN_COMMAND],
    });
  } else {
    const adp = readUint16LE(data, addressOffset);
    const ado = readUint16LE(data, addressOffset + 2);
    const adpName =
      addressing === 'node'
        ? `${label} — ADP (Configured Station Address)`
        : addressing === 'broadcast'
          ? `${label} — ADP (Broadcast Position)`
          : `${label} — ADP (Auto-Increment Address)`;
    fields.push({
      id: `${prefix}-adp`,
      name: adpName,
      offset: addressOffset,
      length: 2,
      rawBytes: data.slice(addressOffset, addressOffset + 2),
      rawValue: adp,
      physicalValue: formatHex(adp, 4),
      valid: true,
      warnings: [],
    });
    fields.push({
      id: `${prefix}-ado`,
      name: `${label} — ADO (Register/Memory Offset)`,
      offset: addressOffset + 2,
      length: 2,
      rawBytes: data.slice(addressOffset + 2, addressOffset + 4),
      rawValue: ado,
      physicalValue: formatHex(ado, 4),
      valid: true,
      warnings: [],
    });
  }

  const lengthOffset = offset + 6;
  const lengthWord = readUint16LE(data, lengthOffset);
  const lengthWordBytes = data.slice(lengthOffset, lengthOffset + 2);
  const dataLength = lengthWord & DATAGRAM_LENGTH_MASK;
  const reservedBits = (lengthWord & DATAGRAM_RESERVED_MASK) >>> 11;
  const circulating = (lengthWord & DATAGRAM_CIRCULATING_MASK) !== 0;
  const more = (lengthWord & DATAGRAM_MORE_MASK) !== 0;

  fields.push({
    id: `${prefix}-length`,
    name: `${label} — Len (bit 0-10)`,
    offset: lengthOffset,
    length: 2,
    rawBytes: lengthWordBytes,
    rawValue: dataLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });
  const reservedField: ParsedField = {
    id: `${prefix}-reserved`,
    name: `${label} — Reserved (bit 11-13)`,
    offset: lengthOffset,
    length: 2,
    rawBytes: lengthWordBytes,
    rawValue: reservedBits,
    valid: reservedBits === 0,
    warnings: [],
  };
  if (reservedBits !== 0) {
    reservedField.warnings.push(WARN_DATAGRAM_RESERVED_BITS_SET);
    warnings.push(WARN_DATAGRAM_RESERVED_BITS_SET);
  }
  fields.push(reservedField);
  fields.push({
    id: `${prefix}-circulating`,
    name: `${label} — Circulating (bit 14)`,
    offset: lengthOffset,
    length: 2,
    rawBytes: lengthWordBytes,
    rawValue: circulating ? 1 : 0,
    physicalValue: circulating ? 'Frame has circulated once' : 'Not circulating',
    valid: true,
    warnings: [],
  });
  fields.push({
    id: `${prefix}-more`,
    name: `${label} — More (bit 15)`,
    offset: lengthOffset,
    length: 2,
    rawBytes: lengthWordBytes,
    rawValue: more ? 1 : 0,
    physicalValue: more ? 'More datagrams follow' : 'Last datagram',
    valid: true,
    warnings: [],
  });

  const irqOffset = offset + 8;
  const irq = readUint16LE(data, irqOffset);
  fields.push({
    id: `${prefix}-irq`,
    name: `${label} — IRQ`,
    offset: irqOffset,
    length: 2,
    rawBytes: data.slice(irqOffset, irqOffset + 2),
    rawValue: irq,
    physicalValue: formatHex(irq, 4),
    valid: true,
    warnings: [],
  });

  const dataOffset = offset + DATAGRAM_HEADER_LENGTH;
  const total = DATAGRAM_HEADER_LENGTH + dataLength + WORKING_COUNTER_LENGTH;
  if (limit - offset < total) {
    // Len alanı bölgeye sığmıyor: veri + WKC yok. Başlık alanları çözüldü,
    // gövde çözülmez — uydurulmuş bir WKC basmaktansa hata basılır.
    errors.push({
      code: 'truncated-frame',
      message: ERROR_DATAGRAM_BODY_TRUNCATED,
      offset: dataOffset,
      length: Math.max(0, limit - dataOffset),
      details: { declaredDataLength: dataLength, availableBytes: Math.max(0, limit - dataOffset) },
    });
    return undefined;
  }

  if (dataLength > 0) {
    // Anlamı slave konfigürasyonuna (PDO eşlemesi / ESC register haritası)
    // bağlıdır; tek çerçeveden çıkarılamaz → HAM + bilgi uyarısı.
    fields.push({
      id: `${prefix}-data`,
      name: `${label} — Data`,
      offset: dataOffset,
      length: dataLength,
      rawBytes: data.slice(dataOffset, dataOffset + dataLength),
      unit: 'B',
      valid: true,
      warnings: [WARN_PROCESS_DATA_NEEDS_CONFIGURATION],
    });
    warnings.push(WARN_PROCESS_DATA_NEEDS_CONFIGURATION);
  }

  const wkcOffset = dataOffset + dataLength;
  const workingCounter = readUint16LE(data, wkcOffset);
  // Beklenen WKC topolojiye bağlıdır (kaç slave işledi) — HESAPLANAMAZ.
  // MAVLink emsali: değer gösterilir, "yanlış" iddiası ASLA basılmaz.
  fields.push({
    id: `${prefix}-working-counter`,
    name: `${label} — Working Counter`,
    offset: wkcOffset,
    length: WORKING_COUNTER_LENGTH,
    rawBytes: data.slice(wkcOffset, wkcOffset + WORKING_COUNTER_LENGTH),
    rawValue: workingCounter,
    valid: true,
    warnings: [WARN_WORKING_COUNTER_NOT_VERIFIABLE],
  });
  warnings.push(WARN_WORKING_COUNTER_NOT_VERIFIABLE);

  return {
    consumed: total,
    more,
    commandLabel: definition?.short ?? formatHex(command, 2),
  };
}

function parseEtherCatFrame(data: Uint8Array, options: EtherCatParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return fail({ code: 'parser-timeout', message: ERROR_ABORTED, recoverable: false });
  }

  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return fail({
      code: 'frame-too-long',
      message: ERROR_FRAME_TOO_LONG,
      recoverable: false,
      offset: options.maxFrameLength,
      length: data.length - options.maxFrameLength,
      details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
    });
  }

  if (data.length < MIN_HEADER_LENGTH + ECAT_HEADER_LENGTH) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_FRAME_TOO_SHORT,
      recoverable: true,
      offset: 0,
      length: data.length,
      details: {
        availableBytes: data.length,
        requiredBytes: MIN_HEADER_LENGTH + ECAT_HEADER_LENGTH,
      },
    });
  }

  const fields: ParsedField[] = [];
  const warningSink = new WarningSink();
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
  summaryParams['destinationMac'] = destinationMac;
  summaryParams['sourceMac'] = sourceMac;

  // VLAN'lı varyant dalga 4a'nın TPID/TCI yürüyüşüyle çözülür (karar 5).
  // `warnings` burada string dizisi bekliyor — sink'e ayrıca aktarılır.
  const chainWarnings: string[] = [];
  const chain = walkTypeLengthChain(data, MAC_LENGTH * 2, fields, chainWarnings, errors);
  for (const key of chainWarnings) warningSink.push(key);

  const etherType = chain.finalValue;
  if (etherType === undefined) {
    // walkTypeLengthChain zaten hatayı bastı (kesik tip alanı / kesik VLAN tag).
    return buildResult(data, fields, warningSink, errors, {
      frameType: undefined,
      datagramCount: 0,
      summaryKey: SUMMARY_NOT_ETHERCAT,
      summaryParams,
    }, options);
  }

  const etherTypeOffset = chain.cursor - TYPE_LENGTH_FIELD_LENGTH;
  const etherTypeMatches = etherType === ETHERCAT_ETHER_TYPE;
  fields.push({
    id: 'ethertype',
    name: 'EtherType',
    offset: etherTypeOffset,
    length: TYPE_LENGTH_FIELD_LENGTH,
    rawBytes: data.slice(etherTypeOffset, chain.cursor),
    rawValue: etherType,
    physicalValue: etherTypeMatches ? 'EtherCAT' : formatHex(etherType, 4),
    valid: etherTypeMatches,
    warnings: etherTypeMatches ? [] : [ERROR_ETHER_TYPE_NOT_ETHERCAT],
  });

  if (!etherTypeMatches) {
    // Bu çerçeve EtherCAT DEĞİL. Ethernet alanları çözüldü, gövdeye
    // DOKUNULMAZ — yanlış EtherType'ta datagram çözmek sessiz-yanlış decode'un
    // ta kendisi olurdu (iec104'ün yanlış start baytı emsali: kısmi çözüm +
    // hata rozeti, ParseFailure değil).
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_ETHER_TYPE_NOT_ETHERCAT,
      offset: etherTypeOffset,
      length: TYPE_LENGTH_FIELD_LENGTH,
      details: { etherType: formatHex(etherType, 4), expected: formatHex(ETHERCAT_ETHER_TYPE, 4) },
    });
    const payload = data.slice(chain.cursor);
    if (payload.length > 0) {
      fields.push({
        id: 'payload',
        name: 'Payload',
        offset: chain.cursor,
        length: payload.length,
        rawBytes: payload,
        unit: 'B',
        valid: false,
        warnings: [ERROR_ETHER_TYPE_NOT_ETHERCAT],
      });
    }
    summaryParams['etherType'] = formatHex(etherType, 4);
    return buildResult(data, fields, warningSink, errors, {
      frameType: undefined,
      datagramCount: 0,
      summaryKey: SUMMARY_NOT_ETHERCAT,
      summaryParams,
    }, options);
  }

  const ecatHeaderOffset = chain.cursor;
  if (data.length - ecatHeaderOffset < ECAT_HEADER_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_HEADER_TRUNCATED,
      offset: ecatHeaderOffset,
      length: data.length - ecatHeaderOffset,
    });
    return buildResult(data, fields, warningSink, errors, {
      frameType: undefined,
      datagramCount: 0,
      summaryKey: SUMMARY_NOT_ETHERCAT,
      summaryParams,
    }, options);
  }

  // ── Buradan itibaren HER ŞEY LITTLE-ENDIAN (dosya başı endianness tuzağı).
  const headerWord = readUint16LE(data, ecatHeaderOffset);
  const headerBytes = data.slice(ecatHeaderOffset, ecatHeaderOffset + ECAT_HEADER_LENGTH);
  const declaredLength = headerWord & FRAME_LENGTH_MASK;
  const headerReserved = (headerWord & FRAME_RESERVED_MASK) >>> 11;
  const frameType = (headerWord & FRAME_TYPE_MASK) >>> FRAME_TYPE_SHIFT;

  fields.push({
    id: 'ecat-length',
    name: 'EtherCAT Length (bit 0-10)',
    offset: ecatHeaderOffset,
    length: ECAT_HEADER_LENGTH,
    rawBytes: headerBytes,
    rawValue: declaredLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });
  const headerReservedField: ParsedField = {
    id: 'ecat-reserved',
    name: 'EtherCAT Reserved (bit 11)',
    offset: ecatHeaderOffset,
    length: ECAT_HEADER_LENGTH,
    rawBytes: headerBytes,
    rawValue: headerReserved,
    valid: headerReserved === 0,
    warnings: [],
  };
  if (headerReserved !== 0) {
    headerReservedField.warnings.push(WARN_FRAME_RESERVED_BIT_SET);
    warningSink.push(WARN_FRAME_RESERVED_BIT_SET);
  }
  fields.push(headerReservedField);

  const frameTypeName = FRAME_TYPE_NAMES.get(frameType);
  const frameTypeField: ParsedField = {
    id: 'ecat-type',
    name: 'EtherCAT Type (bit 12-15)',
    offset: ecatHeaderOffset,
    length: ECAT_HEADER_LENGTH,
    rawBytes: headerBytes,
    rawValue: frameType,
    valid: frameType === FRAME_TYPE_COMMANDS,
    warnings: [],
  };
  if (frameTypeName !== undefined) frameTypeField.physicalValue = frameTypeName;
  fields.push(frameTypeField);

  const regionOffset = ecatHeaderOffset + ECAT_HEADER_LENGTH;
  let datagramCount = 0;
  let summaryKey = SUMMARY_COMMAND_FRAME;

  if (frameType !== FRAME_TYPE_COMMANDS) {
    // Type≠1: gövde datagram zinciri DEĞİL (mailbox/ADS/NV taşıyıcıları).
    // Çözmeye çalışmak uydurma olurdu — ham + uyarı (spec 7259'un emri).
    frameTypeField.warnings.push(WARN_NON_COMMAND_TYPE);
    warningSink.push(WARN_NON_COMMAND_TYPE);
    const regionEnd = Math.min(data.length, regionOffset + declaredLength);
    if (regionEnd > regionOffset) {
      fields.push({
        id: 'ecat-payload',
        name: 'EtherCAT Payload',
        offset: regionOffset,
        length: regionEnd - regionOffset,
        rawBytes: data.slice(regionOffset, regionEnd),
        unit: 'B',
        valid: true,
        warnings: [WARN_NON_COMMAND_TYPE],
      });
    }
    summaryKey = SUMMARY_NON_COMMAND_TYPE;
    summaryParams['type'] = frameTypeName ?? formatHex(frameType, 1);
    appendPadding(data, regionEnd, fields, warningSink);
    return buildResult(data, fields, warningSink, errors, {
      frameType,
      datagramCount: 0,
      summaryKey,
      summaryParams,
    }, options);
  }

  const availableRegion = data.length - regionOffset;
  if (declaredLength > availableRegion) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_DATAGRAM_REGION_TRUNCATED,
      offset: regionOffset,
      length: availableRegion,
      details: { declaredLength, availableBytes: availableRegion },
    });
  }
  const regionLimit = regionOffset + Math.min(declaredLength, availableRegion);

  let cursor = regionOffset;
  let firstCommandLabel = '';
  while (cursor + MIN_DATAGRAM_LENGTH <= regionLimit) {
    if (datagramCount >= MAX_DATAGRAMS) {
      warningSink.push(WARN_DATAGRAM_LIMIT_REACHED);
      break;
    }
    const outcome = decodeDatagram(
      data,
      cursor,
      regionLimit,
      datagramCount,
      fields,
      warningSink,
      errors,
    );
    if (outcome === undefined) {
      // Hata zaten basıldı; zincir burada durur (sonsuz döngü koruması).
      cursor = regionLimit;
      break;
    }
    if (datagramCount === 0) firstCommandLabel = outcome.commandLabel;
    datagramCount += 1;
    cursor += outcome.consumed;
    if (!outcome.more) break;
    if (cursor + MIN_DATAGRAM_LENGTH > regionLimit) {
      // More=1 dedi ama bölgede bir datagram daha için yer yok.
      warningSink.push(WARN_MORE_FLAG_WITHOUT_ROOM);
      break;
    }
  }

  if (datagramCount === 0 && errors.length === 0) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_DATAGRAM_HEADER_TRUNCATED,
      offset: regionOffset,
      length: Math.max(0, regionLimit - regionOffset),
    });
  }

  // Length alanının vaadi ile gerçek tüketim uyuşmuyorsa uyar — off-by-one ve
  // eksik/fazla datagram burada yakalanır (M-Bus'ın iki-L-kopyası emsali).
  if (datagramCount > 0 && cursor !== regionLimit) {
    warningSink.push(WARN_DECLARED_LENGTH_MISMATCH);
  }

  summaryParams['datagramCount'] = String(datagramCount);
  summaryParams['firstCommand'] = firstCommandLabel;
  appendPadding(data, Math.max(cursor, regionLimit), fields, warningSink);

  return buildResult(data, fields, warningSink, errors, {
    frameType,
    datagramCount,
    summaryKey,
    summaryParams,
  }, options);
}

/**
 * Datagram bölgesinden sonra kalan baytlar Ethernet'in 60 baytlık asgari
 * çerçeve boyu için eklenen DOLGUdur (Wireshark `hf_ecat_padding`). Sıfırdan
 * farklıysa uyarı: dolgu olmayan bir şeyi dolgu diye göstermemek için.
 */
function appendPadding(
  data: Uint8Array,
  offset: number,
  fields: ParsedField[],
  warnings: WarningSink,
): void {
  if (offset >= data.length) return;
  const padding = data.slice(offset);
  const paddingField: ParsedField = {
    id: 'padding',
    name: 'Padding',
    offset,
    length: padding.length,
    rawBytes: padding,
    unit: 'B',
    valid: true,
    warnings: [],
  };
  if (padding.some((byte) => byte !== 0)) {
    paddingField.warnings.push(WARN_PADDING_NOT_ZERO);
    warnings.push(WARN_PADDING_NOT_ZERO);
  }
  fields.push(paddingField);
}

function buildResult(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: WarningSink,
  errors: ProtocolError[],
  metadata: EtherCatFrameMetadata,
  options: EtherCatParseOptions,
): ParseResult {
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
    fields,
    valid: errors.length === 0,
    errors,
    warnings: warnings.warnings,
  };

  // Girdi TAM bir Ethernet çerçevesidir: tampon bölünmez, hepsi tüketilir.
  return { success: true, frame, consumedBytes: data.length };
}

export function parseEtherCat(data: Uint8Array): ParseResult {
  return parseEtherCatFrame(data, {});
}

export const ethercatParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme: asgari uzunluk + EtherType 0x88A4. VLAN'lı varyantta tip
   * alanı bir tag kadar (4 bayt) ileridedir; tek tag'e kadar bakılır, ötesi
   * tam çözüme bırakılır (`canParse` O(1) kalmalı, spec §7).
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_HEADER_LENGTH + ECAT_HEADER_LENGTH) return false;
    const first = readUint16BE(data, MAC_LENGTH * 2);
    if (first === ETHERCAT_ETHER_TYPE) return true;
    if (first !== VLAN_TPID) return false;
    if (data.length < MIN_HEADER_LENGTH + VLAN_TAG_LENGTH + ECAT_HEADER_LENGTH) return false;
    return readUint16BE(data, MAC_LENGTH * 2 + VLAN_TAG_LENGTH) === ETHERCAT_ETHER_TYPE;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: EtherCatParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseEtherCatFrame(data, options);
  },
};

/** Örnek çerçevelerde kullanılan sabit MAC'ler — sentetik ama yapısal olarak
 * gerçekçi: master'lar tipik olarak broadcast'e yazar, kaynak NIC MAC'idir. */
const DESTINATION_MAC = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
const SOURCE_MAC = [0x02, 0x00, 0x00, 0x00, 0x00, 0x01];
const ETHER_TYPE_BYTES = [0x88, 0xa4];

/**
 * Örnek üretici — çerçeveyi ELLE değil YAPIYA göre kurar. Böylece örnek
 * baytları motorun kendi sabitlerinden değil, kaynaklardan doğrulanmış bayt
 * bütçesinden (Ethernet 14 + EtherCAT 2 + datagram 10 + veri + WKC 2) türer.
 * Test bu bütçeyi ayrıca BAĞIMSIZ aritmetikle yeniden hesaplar (UBX 3c emsali).
 */
function buildExampleFrame(
  headerWord: number,
  region: readonly number[],
  paddedTotalLength?: number,
): Uint8Array {
  const bytes = [
    ...DESTINATION_MAC,
    ...SOURCE_MAC,
    ...ETHER_TYPE_BYTES,
    headerWord & 0xff,
    (headerWord >>> 8) & 0xff,
    ...region,
  ];
  if (paddedTotalLength !== undefined) {
    while (bytes.length < paddedTotalLength) bytes.push(0x00);
  }
  return Uint8Array.from(bytes);
}

/** Type=1 çerçeve başlığı sözcüğü: uzunluk bit 0-10, Type bit 12-15. */
function commandHeaderWord(regionLength: number): number {
  return (regionLength & FRAME_LENGTH_MASK) | (FRAME_TYPE_COMMANDS << FRAME_TYPE_SHIFT);
}

/** LRW — döngüsel process data; 4 bayt veri, WKC=3, 60 bayta dolgulu. */
const LRW_REGION = [
  0x0c, 0x01, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x00, 0x00, 0x12, 0x34, 0x56, 0x78, 0x03, 0x00,
];
/** FPRD — configured station address 0x03E9, ADO 0x0130 (AL Status), WKC=1. */
const FPRD_REGION = [
  0x04, 0x02, 0xe9, 0x03, 0x30, 0x01, 0x02, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x00,
];
/** BRD — açılış taraması; WKC her yanıtlayan slave için artar (burada 3). */
const BRD_REGION = [
  0x07, 0x00, 0x00, 0x00, 0x30, 0x01, 0x02, 0x00, 0x00, 0x00, 0x08, 0x00, 0x03, 0x00,
];
/** İki datagramlı zincir: BRD (More=1 → 0x8002) ardından LWR (More=0). */
const CHAIN_REGION = [
  0x07, 0x00, 0x00, 0x00, 0x30, 0x01, 0x02, 0x80, 0x00, 0x00, 0x08, 0x00, 0x02, 0x00, 0x0b, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x01, 0x00,
];
/** Teyit edilmemiş komut 0xFF: adlandırılmaz, adres de bölünmez. */
const UNKNOWN_COMMAND_REGION = [
  0xff, 0x03, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0xaa, 0xbb, 0x00, 0x00,
];

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'lrw-cyclic-process-data',
    name: 'protocol.ethercat.example.lrwCyclicProcessData.name',
    bytes: buildExampleFrame(commandHeaderWord(LRW_REGION.length), LRW_REGION, 60),
    description: 'protocol.ethercat.example.lrwCyclicProcessData.description',
    expectedValid: true,
  },
  {
    id: 'fprd-configured-address-read',
    name: 'protocol.ethercat.example.fprdConfiguredAddressRead.name',
    bytes: buildExampleFrame(commandHeaderWord(FPRD_REGION.length), FPRD_REGION),
    description: 'protocol.ethercat.example.fprdConfiguredAddressRead.description',
    expectedValid: true,
  },
  {
    id: 'brd-startup-scan',
    name: 'protocol.ethercat.example.brdStartupScan.name',
    bytes: buildExampleFrame(commandHeaderWord(BRD_REGION.length), BRD_REGION),
    description: 'protocol.ethercat.example.brdStartupScan.description',
    expectedValid: true,
  },
  {
    id: 'multi-datagram-chain',
    name: 'protocol.ethercat.example.multiDatagramChain.name',
    bytes: buildExampleFrame(commandHeaderWord(CHAIN_REGION.length), CHAIN_REGION),
    description: 'protocol.ethercat.example.multiDatagramChain.description',
    expectedValid: true,
  },
  {
    id: 'unknown-command',
    name: 'protocol.ethercat.example.unknownCommand.name',
    bytes: buildExampleFrame(
      commandHeaderWord(UNKNOWN_COMMAND_REGION.length),
      UNKNOWN_COMMAND_REGION,
    ),
    description: 'protocol.ethercat.example.unknownCommand.description',
    expectedValid: true,
  },
  {
    id: 'non-command-type',
    name: 'protocol.ethercat.example.nonCommandType.name',
    // Type=5 (Mailbox): gövde datagram zinciri değil → ham + uyarı yolu.
    bytes: buildExampleFrame(8 | (5 << FRAME_TYPE_SHIFT), [
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    ]),
    description: 'protocol.ethercat.example.nonCommandType.description',
    expectedValid: true,
  },
  {
    id: 'ethertype-not-ethercat',
    name: 'protocol.ethercat.example.etherTypeNotEtherCat.name',
    // LRW örneğiyle aynı gövde, EtherType kasten 0x0800 (IPv4).
    bytes: Uint8Array.from([
      ...DESTINATION_MAC,
      ...SOURCE_MAC,
      0x08,
      0x00,
      commandHeaderWord(LRW_REGION.length) & 0xff,
      (commandHeaderWord(LRW_REGION.length) >>> 8) & 0xff,
      ...LRW_REGION,
    ]),
    description: 'protocol.ethercat.example.etherTypeNotEtherCat.description',
    expectedValid: false,
  },
  {
    id: 'datagram-truncated',
    name: 'protocol.ethercat.example.datagramTruncated.name',
    // Başlık 16 baytlık bir bölge vaat eder, telde yalnız 6 bayt var.
    bytes: buildExampleFrame(commandHeaderWord(16), [0x0c, 0x01, 0x00, 0x00, 0x01, 0x00]),
    description: 'protocol.ethercat.example.datagramTruncated.description',
    expectedValid: false,
  },
  {
    id: 'frame-too-short',
    name: 'protocol.ethercat.example.frameTooShort.name',
    // 10 bayt: Ethernet başlığı bile tamamlanmıyor → ParseFailure.
    bytes: Uint8Array.from([...DESTINATION_MAC, ...SOURCE_MAC.slice(0, 4)]),
    description: 'protocol.ethercat.example.frameTooShort.description',
    expectedValid: false,
  },
];

export const ethercatPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: ethercatParser,
  documentation: {
    summary: 'protocol.ethercat.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'Wireshark EtherCAT dissector plugin (© 2007 Beckhoff Automation GmbH) — field layout reference',
        url: 'https://github.com/wireshark/wireshark/tree/master/plugins/epan/ethercat',
      },
      {
        title: 'IgH EtherCAT Master (GPLv2 — documented constants referenced only)',
        url: 'https://gitlab.com/etherlab.org/ethercat',
      },
      {
        title: 'SOEM — Simple Open EtherCAT Master (ethercattype.h command set)',
        url: 'https://github.com/OpenEtherCATsociety/SOEM',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
