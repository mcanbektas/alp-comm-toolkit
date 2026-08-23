/**
 * PROFINET (PI / IEC 61158-6-10) — Ethernet tabanlı endüstriyel otomasyon
 * standardı. Girdi TAM BİR ETHERNET ÇERÇEVESİdir: DST MAC + SRC MAC
 * (+ opsiyonel VLAN tag'leri) + EtherType 0x8892 (PN-RT) + FrameID (2 bayt) +
 * sınıfa göre değişen gövde (+ Ethernet dolgusu).
 *
 * Faz 10, dalga 13e. `industrial-ethernet` ailesinin ikinci `ready` kaydı.
 *
 * ── GİRDİ MODELİ — AİLE İÇİ TUTARLILIK KARARI ───────────────────────────────
 * `ethercat.ts` (aynı ailenin ilk `ready` kaydı) TAM Ethernet çerçevesi alır ve
 * `network/ethernet/ethernetFrame.ts`in dışa açılan yardımcılarını PAYLAŞIR
 * (`formatMac`, `classifyDestinationMac`, `walkTypeLengthChain`). PROFINET de
 * AYNI ÇİZGİDE: aynı ailede iki farklı girdi sözleşmesi olmaz. Gerekçe
 * EtherCAT'inkiyle birebir aynıdır — PN-RT, IP'nin üstünde taşınan bir üst
 * katman değil, EtherType'ın DOĞRUDAN işaret ettiği çerçevenin kendisidir;
 * dolayısıyla Ethernet başlık alanları da bu motorun alanlarıdır. İkinci bir
 * MAC formatlayıcı ya da ikinci bir VLAN yürüyüşü YAZILMADI.
 *
 * NOT: `brief-faz10-dalga13.md:38-42` "ethercat.ts `ethernetFrame.ts`ten
 * HİÇBİR ŞEY import etmiyor, emsal budur" diyor — bu tespit KODLA ÇÜRÜDÜ
 * (`ethercat.ts:96-105` üç yardımcıyı da import ediyor). Doğru emsal
 * paylaşımdır ve burada o izlendi.
 *
 * ── KAYNAK UYARISI ──────────────────────────────────────────────────────────
 * PI spec'leri (IEC 61158-6-10) üyelik/ücret arkasındadır ve bu depoda YOKTUR.
 * Alan yerleşimleri İKİ bağımsız, kamuya açık kaynaktan ÇAPRAZ TEYİTLE alındı
 * (ikisine de bu oturumda gerçekten erişildi; KOD KOPYALANMADI):
 *   W = **Wireshark PROFINET eklentisi** (GPL-2.0-or-later)
 *       `plugins/epan/profinet/{packet-pn-rt.c, packet-pn-dcp.c, packet-pn.h,
 *       packet-dcerpc-pn-io.c}`; `epan/etypes.h` `ETHERTYPE_PROFINET 0x8892`.
 *       https://github.com/wireshark/wireshark/tree/master/plugins/epan/profinet
 *   P = **p-net** (RT-Labs AB, GPLv3/ticari çift lisans)
 *       `src/{pf_types.h, common/pf_dcp.[ch], common/pf_alarm.c}`,
 *       `include/pnet_api.h`; `PF_UDP_UNICAST_PORT 0x8892` ve
 *       `lt_field` alanının "Allowed: 0x8892" yorumu EtherType'ı doğrular.
 *       https://github.com/rtlabs-com/p-net
 * FrameID bandı, DCP ve alarm ayrıntılarının kaynak dökümü kendi dosyalarının
 * başındadır (`profinetFrameId.ts`, `profinetDcp.ts`, `profinetAlarm.ts`).
 *
 * DataStatus bitleri İKİ KAYNAKTA BİREBİR aynı (çakışma yok):
 * W `hf_pn_rt_data_status_*` maskeleri 0x01/0x02/0x04/0x08/0x10/0x20/0x40/0x80;
 * P `pnet_data_status_bits_t` aynı sırayı bit numarası olarak sayar
 * (STATE, REDUNDANCY, DATA_VALID, RESERVED_1, PROVIDER_STATE,
 * STATION_PROBLEM_INDICATOR, RESERVED_2, IGNORE).
 *
 * ── EN KRİTİK TUZAK: APDU STATUS ÇERÇEVE SONUNDAN GERİ SAYILIR ─────────────
 * Döngüsel (RT cyclic) çerçevede I/O verisinin uzunluğu ÇERÇEVEDE YAZMAZ —
 * mühendislik konfigürasyonundan (GSDML + slot/subslot planı) gelir. Çerçevenin
 * SONUNDA sabit 4 baytlık APDU Status vardır: CycleCounter(2) + DataStatus(1)
 * + TransferStatus(1). Yani APDU Status ancak ÇERÇEVE SONUNDAN GERİ SAYILARAK
 * bulunur, baştan ilerleyerek DEĞİL. İki kaynak da bunu böyle yapar:
 * W `packet-pn-rt.c` `tvb_get_ntohs(tvb, pdu_len - 4)` / `pdu_len - 2` /
 * `pdu_len - 1` ve `data_len = pdu_len - 2 - 4`; P `pf_iocr_t`in
 * `cycle_counter_offset` / `data_status_offset` / `transfer_status_offset`
 * alanları çerçeve boyundan türetilir.
 * BUNUN BEDELİ: yakalamada çerçevenin SONUNA eklenmiş her bayt (Ethernet
 * dolgusu ya da yakalanmış FCS) APDU Status'u KAYDIRIR. Çerçevede bunu
 * yakalayacak bir uzunluk alanı YOKTUR, dolayısıyla bu motor konumu dürüstçe
 * bildirir ve `WARN_APDU_STATUS_FROM_FRAME_END` ile kullanıcıyı uyarır.
 *
 * ── I/O VERİSİ HAM BIRAKILIR — SAHTE ALAN KIRILIMI YOK ──────────────────────
 * IOPS/IOCS (provider/consumer status) baytları submodule verisiyle İÇ İÇE
 * geçer ve konumları yalnız GSDML/AR bağlamından bilinir: P'de bu ofsetler
 * (`pf_iodata_object_t.data_offset / iops_offset / iocs_offset`)
 * `pf_cmdev.c`de CONNECT isteğindeki IOCR tanımlarından HESAPLANIR, döngüsel
 * çerçeveden okunmaz. Bu yüzden I/O bölgesi TEK PARÇA HAM basılır ve
 * `WARN_IO_DATA_NEEDS_GSDML` ile işaretlenir. Uydurma bir kırılım basmak
 * yasaktır (spec 7259; MAVLink/EtherCAT emsali).
 *
 * ── decodeOptions: AÇILMADI, GEREKÇESİ ──────────────────────────────────────
 *  1. "I/O veri uzunluğu" / "APDU Status var mı" → ÇERÇEVEDEN ÇIKARILABİLİR:
 *     sınıf FrameID'den, uzunluk çerçeve sonundan geri sayılarak. Kanal
 *     gereksiz olurdu (dalga 12f'nin WebSocket MASK-biti dersi).
 *  2. "IOPS/IOCS konumları" → bir `select`/`number` alanına SIĞMAZ; slot/
 *     subslot ağacı ister. Yarım bir kanal yanlış kırılıma davet olurdu.
 *  3. "time-aware (TSN) profili" → çerçevede değil OTURUMDA (bkz.
 *     `profinetFrameId.ts` dosya başı); tek çerçeve çözen bir motorda
 *     kullanıcı da bunu bilemez, uyarı doğru olanı söyler.
 *
 * ── KAPSAM DIŞI (dosya başında AÇIKÇA) ──────────────────────────────────────
 *  • **PN-IO acyclic** (Connect / Release / Read / Write): DCE/RPC üzerinden
 *    UDP/IP'de taşınır — bu motorun girdisi HAM ETHERNET çerçevesidir, o yol
 *    ayrı ve büyük bir tel biçimidir. Bilinçli kapsam dışı.
 *  • **PTCP** (Sync / Follow Up / Delay / Announce): 0x8892 altında gelir ve bu
 *    motora düşebilir, bu yüzden SINIFLANDIRILIR ama gövdesi HAM bırakılır —
 *    kendi başına bir tel biçimidir (`packet-pn-ptcp.c` ayrı bir dissector).
 *  • **"with security" varyantları** (0xFC41/0xFE41/0xFE42): tek kaynakta;
 *    ayrıca kripto sınırı geçerli — zarf açılır, doğrulama/şifre çözme YAPILMAZ.
 *  • **GSDML** (XML cihaz tanımı): `definitions` sekmesi "planlandı" bildirimi
 *    basar (CLAUDE.md bunu açıkça meşru sayar); ayrıştırıcı bu dalganın
 *    kapsamı değildir.
 *  • **Çok çerçeveli analiz**: slot/subslot ağacı, timing/jitter, AR durum
 *    çizelgesi — `ethercat.ts`in "analyzer sınırı" emsali. Bu motor tek
 *    çerçevenin alanlarını verir.
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

import { decodeAlarmPdu } from './profinetAlarm';
import { decodeDcpPdu } from './profinetDcp';
import { APDU_STATUS_LENGTH, classifyFrameId } from './profinetFrameId';

/** Katalogdaki kayıt id'siyle birebir aynı olmalı — plugin bağı budur. */
const PROTOCOL_ID = 'profinet';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'PROFINET';

/** PN-RT'nin tel üstündeki tek kimliği (W `ETHERTYPE_PROFINET`, P `lt_field`). */
const PROFINET_ETHER_TYPE = 0x8892;

/** FrameID: PN-RT gövdesinin ilk iki baytı, big-endian. */
const FRAME_ID_LENGTH = 2;

const HEX_RADIX = 16;
/** VLAN'lı varyantta tip alanı bir tag kadar ilerideki ofsettedir. */
const VLAN_TAG_LENGTH = 4;

export const ERROR_FRAME_TOO_SHORT = 'protocol.profinet.error.frameTooShort';
export const ERROR_FRAME_TOO_LONG = 'protocol.profinet.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.profinet.error.aborted';
export const ERROR_ETHER_TYPE_NOT_PROFINET = 'protocol.profinet.error.etherTypeNotProfinet';
export const ERROR_CYCLIC_TOO_SHORT = 'protocol.profinet.error.cyclicTooShort';

export const WARN_APDU_STATUS_FROM_FRAME_END = 'protocol.profinet.warning.apduStatusFromFrameEnd';
export const WARN_IO_DATA_NEEDS_GSDML = 'protocol.profinet.warning.ioDataNeedsGsdml';
export const WARN_DATA_STATUS_RESERVED_BITS = 'protocol.profinet.warning.dataStatusReservedBits';
export const WARN_TRANSFER_STATUS_NOT_OK = 'protocol.profinet.warning.transferStatusNotOk';
export const WARN_TSN_PROFILE_REASSIGNS_RANGE =
  'protocol.profinet.warning.tsnProfileReassignsRange';
export const WARN_PTCP_BODY_NOT_DECODED = 'protocol.profinet.warning.ptcpBodyNotDecoded';
export const WARN_RESERVED_FRAME_ID = 'protocol.profinet.warning.reservedFrameId';
export const WARN_FRAGMENTATION_NOT_DECODED = 'protocol.profinet.warning.fragmentationNotDecoded';
export const WARN_PADDING_NOT_ZERO = 'protocol.profinet.warning.paddingNotZero';

const SUMMARY_CYCLIC = 'protocol.profinet.summary.cyclic';
const SUMMARY_DCP = 'protocol.profinet.summary.dcp';
const SUMMARY_ALARM = 'protocol.profinet.summary.alarm';
const SUMMARY_OTHER = 'protocol.profinet.summary.other';
const SUMMARY_NOT_PROFINET = 'protocol.profinet.summary.notProfinet';

/** DataStatus bit maskeleri — W maskeleri ve P bit numaralarıyla birebir. */
const DATA_STATUS_STATE_MASK = 0x01;
const DATA_STATUS_REDUNDANCY_MASK = 0x02;
const DATA_STATUS_DATA_VALID_MASK = 0x04;
const DATA_STATUS_RESERVED_1_MASK = 0x08;
const DATA_STATUS_PROVIDER_STATE_MASK = 0x10;
const DATA_STATUS_STATION_PROBLEM_MASK = 0x20;
const DATA_STATUS_RESERVED_2_MASK = 0x40;
const DATA_STATUS_IGNORE_MASK = 0x80;

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** PROFINET'in TAMAMI network order'dır — EtherCAT'in aksine LE geçişi YOK. */
function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function formatHex(value: number, digits: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(digits, '0')}`;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/**
 * Frame düzeyindeki uyarıları TEKRARSIZ biriktirir: aynı not (ör. "I/O verisi
 * GSDML ister") alan düzeyinde birden çok kez basılabilir ama frame rozetinde
 * bir kez görünmelidir (ethercat.ts'in `WarningSink` deseni).
 */
class WarningSink {
  private readonly seen = new Set<string>();
  readonly warnings: ProtocolWarning[] = [];
  /** Alt motorların `string[]` bekleyen imzasına verilen tampon. */
  readonly buffer: string[] = [];

  push(key: string): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.warnings.push(toProtocolWarning(key));
  }

  /** Alt motorların tampona yazdıklarını sink'e taşır. */
  drain(): void {
    for (const key of this.buffer) this.push(key);
    this.buffer.length = 0;
  }
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

export type ProfinetFrameMetadata = {
  /** EtherType yanlışsa `undefined`. */
  frameId: number | undefined;
  frameClass: string;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface ProfinetParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

/**
 * Bildirilen bölgeden sonra kalan baytlar Ethernet'in 60 baytlık asgari çerçeve
 * boyu için eklenen DOLGUdur. Sıfırdan farklıysa uyarı: dolgu olmayan bir şeyi
 * dolgu diye göstermemek için (ethercat.ts emsali).
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

/** DataStatus'un sekiz bitini tek tek basar. Her bit KENDİ adıyla görünür. */
function appendDataStatusBits(
  data: Uint8Array,
  offset: number,
  value: number,
  fields: ParsedField[],
  warnings: WarningSink,
): void {
  const bytes = data.slice(offset, offset + 1);
  const bit = (mask: number): number => ((value & mask) === 0 ? 0 : 1);

  const entries: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly mask: number;
    readonly onLabel: string;
    readonly offLabel: string;
  }> = [
    {
      id: 'data-status-state',
      name: 'DataStatus — State (bit 0)',
      mask: DATA_STATUS_STATE_MASK,
      onLabel: 'Primary',
      offLabel: 'Backup',
    },
    {
      id: 'data-status-redundancy',
      name: 'DataStatus — Redundancy (bit 1)',
      mask: DATA_STATUS_REDUNDANCY_MASK,
      // Anlamı State bitine bağlıdır (P: "Meaning depends on STATE bit") —
      // tek çerçeveden çözülemez, bu yüzden yalnız bitin KENDİSİ adlandırılır,
      // "yedekli/yedeksiz" gibi bir yorum BASILMAZ.
      onLabel: 'Set',
      offLabel: 'Not set',
    },
    {
      id: 'data-status-data-valid',
      name: 'DataStatus — DataValid (bit 2)',
      mask: DATA_STATUS_DATA_VALID_MASK,
      onLabel: 'Valid',
      offLabel: 'Invalid',
    },
    {
      id: 'data-status-provider-state',
      name: 'DataStatus — ProviderState (bit 4)',
      mask: DATA_STATUS_PROVIDER_STATE_MASK,
      onLabel: 'Run',
      offLabel: 'Stop',
    },
    {
      id: 'data-status-station-problem',
      name: 'DataStatus — StationProblemIndicator (bit 5)',
      mask: DATA_STATUS_STATION_PROBLEM_MASK,
      onLabel: 'Normal operation',
      offLabel: 'Problem detected',
    },
    {
      id: 'data-status-ignore',
      name: 'DataStatus — Ignore (bit 7)',
      mask: DATA_STATUS_IGNORE_MASK,
      onLabel: 'Ignore',
      offLabel: 'Evaluate',
    },
  ];

  for (const entry of entries) {
    fields.push({
      id: entry.id,
      name: entry.name,
      offset,
      length: 1,
      rawBytes: bytes,
      rawValue: bit(entry.mask),
      physicalValue: bit(entry.mask) === 1 ? entry.onLabel : entry.offLabel,
      valid: true,
      warnings: [],
    });
  }

  const reserved =
    (value & DATA_STATUS_RESERVED_1_MASK) | (value & DATA_STATUS_RESERVED_2_MASK);
  const reservedField: ParsedField = {
    id: 'data-status-reserved',
    name: 'DataStatus — Reserved (bit 3, 6)',
    offset,
    length: 1,
    rawBytes: bytes,
    rawValue: reserved,
    valid: reserved === 0,
    warnings: [],
  };
  if (reserved !== 0) {
    reservedField.warnings.push(WARN_DATA_STATUS_RESERVED_BITS);
    warnings.push(WARN_DATA_STATUS_RESERVED_BITS);
  }
  fields.push(reservedField);
}

/**
 * Döngüsel çerçeve gövdesi. `bodyStart` FrameID'den SONRAKİ ilk bayt.
 * APDU Status ÇERÇEVE SONUNDAN geri sayılır (dosya başı, en kritik tuzak).
 */
function decodeCyclicBody(
  data: Uint8Array,
  bodyStart: number,
  fields: ParsedField[],
  warnings: WarningSink,
  errors: ProtocolError[],
): void {
  const available = data.length - bodyStart;
  if (available < APDU_STATUS_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_CYCLIC_TOO_SHORT,
      offset: bodyStart,
      length: Math.max(0, available),
      details: { availableBytes: Math.max(0, available), requiredBytes: APDU_STATUS_LENGTH },
    });
    return;
  }

  const apduStatusOffset = data.length - APDU_STATUS_LENGTH;
  const ioDataLength = apduStatusOffset - bodyStart;

  if (ioDataLength > 0) {
    // GSDML/AR olmadan kırılamaz — TEK PARÇA ham (dosya başı).
    fields.push({
      id: 'io-data',
      name: 'IO Data (IOPS/IOCS interleaved)',
      offset: bodyStart,
      length: ioDataLength,
      rawBytes: data.slice(bodyStart, apduStatusOffset),
      unit: 'B',
      valid: true,
      warnings: [WARN_IO_DATA_NEEDS_GSDML],
    });
    warnings.push(WARN_IO_DATA_NEEDS_GSDML);
  }

  const cycleCounter = readUint16BE(data, apduStatusOffset);
  fields.push({
    id: 'cycle-counter',
    name: 'APDU Status — CycleCounter',
    offset: apduStatusOffset,
    length: 2,
    rawBytes: data.slice(apduStatusOffset, apduStatusOffset + 2),
    rawValue: cycleCounter,
    valid: true,
    warnings: [WARN_APDU_STATUS_FROM_FRAME_END],
  });
  warnings.push(WARN_APDU_STATUS_FROM_FRAME_END);

  const dataStatusOffset = apduStatusOffset + 2;
  const dataStatus = byteAt(data, dataStatusOffset);
  fields.push({
    id: 'data-status',
    name: 'APDU Status — DataStatus',
    offset: dataStatusOffset,
    length: 1,
    rawBytes: data.slice(dataStatusOffset, dataStatusOffset + 1),
    rawValue: dataStatus,
    physicalValue: formatHex(dataStatus, 2),
    valid: true,
    warnings: [WARN_APDU_STATUS_FROM_FRAME_END],
  });
  appendDataStatusBits(data, dataStatusOffset, dataStatus, fields, warnings);

  const transferStatusOffset = apduStatusOffset + 3;
  const transferStatus = byteAt(data, transferStatusOffset);
  const transferField: ParsedField = {
    id: 'transfer-status',
    name: 'APDU Status — TransferStatus',
    offset: transferStatusOffset,
    length: 1,
    rawBytes: data.slice(transferStatusOffset, transferStatusOffset + 1),
    rawValue: transferStatus,
    // İki kaynak da yalnız "0 = OK, ≠0 = bu çerçeveyi yok say" ayrımını verir.
    physicalValue: transferStatus === 0 ? 'OK' : 'Ignore this frame',
    valid: true,
    warnings: [WARN_APDU_STATUS_FROM_FRAME_END],
  };
  if (transferStatus !== 0) {
    transferField.warnings.push(WARN_TRANSFER_STATUS_NOT_OK);
    warnings.push(WARN_TRANSFER_STATUS_NOT_OK);
  }
  fields.push(transferField);
}

function buildResult(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: WarningSink,
  errors: ProtocolError[],
  metadata: ProfinetFrameMetadata,
  options: ProfinetParseOptions,
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

function parseProfinetFrame(data: Uint8Array, options: ProfinetParseOptions): ParseResult {
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

  if (data.length < MIN_HEADER_LENGTH + FRAME_ID_LENGTH) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_FRAME_TOO_SHORT,
      recoverable: true,
      offset: 0,
      length: data.length,
      details: {
        availableBytes: data.length,
        requiredBytes: MIN_HEADER_LENGTH + FRAME_ID_LENGTH,
      },
    });
  }

  const fields: ParsedField[] = [];
  const warnings = new WarningSink();
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

  // VLAN'lı varyant dalga 4a'nın TPID/TCI yürüyüşüyle çözülür (girdi modeli).
  const chain = walkTypeLengthChain(data, MAC_LENGTH * 2, fields, warnings.buffer, errors);
  warnings.drain();

  const etherType = chain.finalValue;
  if (etherType === undefined) {
    // walkTypeLengthChain hatayı zaten bastı (kesik tip alanı / kesik VLAN tag).
    return buildResult(
      data,
      fields,
      warnings,
      errors,
      {
        frameId: undefined,
        frameClass: 'unknown',
        summaryKey: SUMMARY_NOT_PROFINET,
        summaryParams,
      },
      options,
    );
  }

  const etherTypeOffset = chain.cursor - TYPE_LENGTH_FIELD_LENGTH;
  const etherTypeMatches = etherType === PROFINET_ETHER_TYPE;
  fields.push({
    id: 'ethertype',
    name: 'EtherType',
    offset: etherTypeOffset,
    length: TYPE_LENGTH_FIELD_LENGTH,
    rawBytes: data.slice(etherTypeOffset, chain.cursor),
    rawValue: etherType,
    physicalValue: etherTypeMatches ? 'PROFINET (PN-RT)' : formatHex(etherType, 4),
    valid: etherTypeMatches,
    warnings: etherTypeMatches ? [] : [ERROR_ETHER_TYPE_NOT_PROFINET],
  });

  if (!etherTypeMatches) {
    // Bu çerçeve PROFINET DEĞİL. Ethernet alanları çözüldü, gövdeye
    // DOKUNULMAZ — yanlış EtherType'ta FrameID çözmek sessiz-yanlış decode'un
    // ta kendisi olurdu (ethercat.ts ve iec104 emsali: kısmi çözüm + hata
    // rozeti, ParseFailure DEĞİL).
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_ETHER_TYPE_NOT_PROFINET,
      offset: etherTypeOffset,
      length: TYPE_LENGTH_FIELD_LENGTH,
      details: {
        etherType: formatHex(etherType, 4),
        expected: formatHex(PROFINET_ETHER_TYPE, 4),
      },
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
        warnings: [ERROR_ETHER_TYPE_NOT_PROFINET],
      });
    }
    summaryParams['etherType'] = formatHex(etherType, 4);
    return buildResult(
      data,
      fields,
      warnings,
      errors,
      {
        frameId: undefined,
        frameClass: 'unknown',
        summaryKey: SUMMARY_NOT_PROFINET,
        summaryParams,
      },
      options,
    );
  }

  const frameIdOffset = chain.cursor;
  if (data.length - frameIdOffset < FRAME_ID_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_FRAME_TOO_SHORT,
      offset: frameIdOffset,
      length: data.length - frameIdOffset,
    });
    return buildResult(
      data,
      fields,
      warnings,
      errors,
      {
        frameId: undefined,
        frameClass: 'unknown',
        summaryKey: SUMMARY_NOT_PROFINET,
        summaryParams,
      },
      options,
    );
  }

  const frameId = readUint16BE(data, frameIdOffset);
  const classification = classifyFrameId(frameId);
  const frameIdField: ParsedField = {
    id: 'frame-id',
    name: 'FrameID',
    offset: frameIdOffset,
    length: FRAME_ID_LENGTH,
    rawBytes: data.slice(frameIdOffset, frameIdOffset + FRAME_ID_LENGTH),
    rawValue: frameId,
    physicalValue: classification.label,
    valid: classification.frameClass !== 'reserved',
    warnings: [],
  };
  if (classification.tsnAmbiguous) {
    frameIdField.warnings.push(WARN_TSN_PROFILE_REASSIGNS_RANGE);
    warnings.push(WARN_TSN_PROFILE_REASSIGNS_RANGE);
  }
  if (classification.frameClass === 'reserved') {
    frameIdField.warnings.push(WARN_RESERVED_FRAME_ID);
    warnings.push(WARN_RESERVED_FRAME_ID);
  }
  fields.push(frameIdField);

  summaryParams['frameId'] = formatHex(frameId, 4);
  summaryParams['frameClass'] = classification.label;

  const bodyStart = frameIdOffset + FRAME_ID_LENGTH;
  let summaryKey = SUMMARY_OTHER;

  if (classification.frameClass === 'rt-cyclic') {
    decodeCyclicBody(data, bodyStart, fields, warnings, errors);
    summaryKey = SUMMARY_CYCLIC;
    // Döngüsel çerçevede bildirilen uzunluk YOKTUR: dolgu ile veriyi ayıracak
    // bir alan da yok, bu yüzden ayrı bir Padding alanı BASILMAZ (uydurma olur).
  } else if (classification.frameClass === 'dcp') {
    const summary = decodeDcpPdu(data, bodyStart, data.length, fields, warnings.buffer, errors);
    warnings.drain();
    summaryKey = SUMMARY_DCP;
    if (summary !== undefined) {
      summaryParams['service'] = `${summary.serviceLabel} ${summary.isResponse ? 'Res' : 'Req'}`;
      summaryParams['blockCount'] = String(summary.blockCount);
      appendPadding(data, bodyStart + summary.consumedBytes, fields, warnings);
    }
  } else if (classification.frameClass === 'alarm') {
    const summary = decodeAlarmPdu(data, bodyStart, data.length, fields, warnings.buffer, errors);
    warnings.drain();
    summaryKey = SUMMARY_ALARM;
    if (summary !== undefined) {
      summaryParams['pduType'] = summary.pduTypeLabel;
      summaryParams['alarmType'] =
        summary.alarmTypeLabel ??
        (summary.alarmType === undefined ? '-' : formatHex(summary.alarmType, 4));
      appendPadding(data, bodyStart + summary.consumedBytes, fields, warnings);
    }
  } else if (data.length > bodyStart) {
    // PTCP / fragmentation / reserved: gövde bu motorun kapsamı DIŞINDA
    // (dosya başı). Ham basılır ve NEDEN çözülmediği uyarıyla söylenir —
    // "boş kart basmak yasak" kuralının gereği.
    const bodyWarning =
      classification.frameClass === 'ptcp'
        ? WARN_PTCP_BODY_NOT_DECODED
        : classification.frameClass === 'fragmentation'
          ? WARN_FRAGMENTATION_NOT_DECODED
          : WARN_RESERVED_FRAME_ID;
    fields.push({
      id: 'payload',
      name: 'PN-RT Payload',
      offset: bodyStart,
      length: data.length - bodyStart,
      rawBytes: data.slice(bodyStart),
      unit: 'B',
      valid: true,
      warnings: [bodyWarning],
    });
    warnings.push(bodyWarning);
  }

  return buildResult(
    data,
    fields,
    warnings,
    errors,
    {
      frameId,
      frameClass: classification.frameClass,
      summaryKey,
      summaryParams,
    },
    options,
  );
}

export function parseProfinet(data: Uint8Array): ParseResult {
  return parseProfinetFrame(data, {});
}

export const profinetParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme: asgari uzunluk + EtherType 0x8892. VLAN'lı varyantta tip
   * alanı bir tag kadar (4 bayt) ileridedir; tek tag'e kadar bakılır, ötesi
   * tam çözüme bırakılır (`canParse` O(1) kalmalı, spec §7).
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_HEADER_LENGTH + FRAME_ID_LENGTH) return false;
    const first = readUint16BE(data, MAC_LENGTH * 2);
    if (first === PROFINET_ETHER_TYPE) return true;
    if (first !== VLAN_TPID) return false;
    if (data.length < MIN_HEADER_LENGTH + VLAN_TAG_LENGTH + FRAME_ID_LENGTH) return false;
    return readUint16BE(data, MAC_LENGTH * 2 + VLAN_TAG_LENGTH) === PROFINET_ETHER_TYPE;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: ProfinetParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseProfinetFrame(data, options);
  },
};

// ── Örnek çerçeveler ────────────────────────────────────────────────────────
// Baytlar ELLE değil YAPIYA göre kurulur: uzunluk alanları bölge dizilerinden
// HESAPLANIR, böylece örnek kaynaklardan doğrulanmış bayt bütçesinden türer ve
// bir alan eklenince uzunluk güncellemeyi unutmak imkansızlaşır (ethercat.ts
// `buildExampleFrame` emsali). Testler bu bütçeyi BAĞIMSIZ aritmetikle
// yeniden hesaplar.

/** DCP çok noktaya yayın adresleri — Identify isteği ve Hello için. */
const DCP_IDENTIFY_MULTICAST_MAC = [0x01, 0x0e, 0xcf, 0x00, 0x00, 0x00];
/** p-net `dcp_mc_addr_hello` ile birebir. */
const DCP_HELLO_MULTICAST_MAC = [0x01, 0x0e, 0xcf, 0x00, 0x00, 0x01];
/** Örneklerdeki IO controller/device MAC'leri sentetik ama yapısal (locally administered). */
const CONTROLLER_MAC = [0x02, 0x00, 0x00, 0x11, 0x22, 0x33];
const DEVICE_MAC = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55];
const ETHER_TYPE_BYTES = [0x88, 0x92];

function uint16(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function uint32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

/** Ethernet başlığı + FrameID + gövde; istenirse 60 bayta sıfır dolgu. */
function buildFrame(
  destination: readonly number[],
  source: readonly number[],
  frameId: number,
  body: readonly number[],
  padToLength?: number,
): Uint8Array {
  const bytes = [...destination, ...source, ...ETHER_TYPE_BYTES, ...uint16(frameId), ...body];
  if (padToLength !== undefined) {
    while (bytes.length < padToLength) bytes.push(0x00);
  }
  return Uint8Array.from(bytes);
}

/** Option+Suboption+DCPBlockLength+değer; TEK uzunlukta 1 pad baytı EKLER. */
function dcpBlock(option: number, suboption: number, value: readonly number[]): number[] {
  const block = [option, suboption, ...uint16(value.length), ...value];
  if ((block.length & 1) === 1) block.push(0x00);
  return block;
}

/** ServiceID+ServiceType+Xid+ResponseDelay/Reserved+DCPDataLength+bloklar. */
function dcpPdu(
  serviceId: number,
  serviceType: number,
  xid: number,
  responseDelay: number,
  blocks: readonly number[],
): number[] {
  return [
    serviceId,
    serviceType,
    ...uint32(xid),
    ...uint16(responseDelay),
    ...uint16(blocks.length),
    ...blocks,
  ];
}

const BLOCK_INFO_ZERO = uint16(0x0000);

/**
 * Identify yanıtı. İLK blok (Manufacturer, değer = BlockInfo 2 + "ALP RT IO" 9
 * = 11 bayt → TEK) pad tuzağını tetikler; ardından gelen üç blok pad'in
 * atlanıp atlanmadığını KANITLAR — atlanırsa 2. bloğun Option baytı 'c' (0x63)
 * okunur ve zincir dağılır.
 */
const DCP_IDENTIFY_RESPONSE_BLOCKS = [
  ...dcpBlock(0x02, 0x01, [...BLOCK_INFO_ZERO, ...ascii('ALP RT IO')]),
  ...dcpBlock(0x02, 0x02, [...BLOCK_INFO_ZERO, ...ascii('conveyor-io-01')]),
  ...dcpBlock(0x01, 0x02, [
    ...uint16(0x0001),
    192, 168, 10, 25,
    255, 255, 255, 0,
    192, 168, 10, 1,
  ]),
  ...dcpBlock(0x02, 0x03, [...BLOCK_INFO_ZERO, ...uint16(0x002a), ...uint16(0x0303)]),
];

/** Identify isteği: yalnız All Selector bloğu (uzunluk 0), ResponseDelay 0x0100. */
const DCP_IDENTIFY_REQUEST_BLOCKS = dcpBlock(0xff, 0xff, []);

/** Get isteği: bloklar DEĞİL seçici çiftleri (tuzak 3). */
const DCP_GET_REQUEST_SELECTORS = [0x02, 0x02, 0x01, 0x02, 0x02, 0x03];

/**
 * Set yanıtı: İKİ Control/Response bloğu. Her birinin değeri 3 bayt (Option +
 * Suboption + BlockError) → DCPBlockLength TEK → her blok 1 pad baytı taşır.
 * İkinci bloğun doğru yerde okunması pad'in tüketildiğinin kanıtıdır.
 */
const DCP_SET_RESPONSE_BLOCKS = [
  ...dcpBlock(0x05, 0x04, [0x02, 0x02, 0x00]),
  ...dcpBlock(0x05, 0x04, [0x01, 0x02, 0x03]),
];

/**
 * Döngüsel I/O gövdesi: 40 bayt opak I/O verisi + 4 bayt APDU Status.
 * Spec özetindeki örnek değerler (Control Word 0x000F, Speed Setpoint 1500 rpm
 * = 0x05DC) verinin BAŞINA konuldu ama ADLANDIRILMADI — kırılımı GSDML verir.
 */
const CYCLIC_IO_DATA = [
  ...uint16(0x000f),
  ...uint16(0x05dc),
  ...new Array<number>(36).fill(0x00),
];
/** DataStatus 0x35 = Primary + DataValid + Run + Normal operation. */
const CYCLIC_APDU_STATUS_OK = [...uint16(0x1234), 0x35, 0x00];
/** DataStatus 0x20 = Backup + Invalid + Stop; TransferStatus ≠ 0 → yok say. */
const CYCLIC_APDU_STATUS_PROBLEM = [...uint16(0x00ff), 0x20, 0x01];

/** RTA sabit başlığı + AlarmNotification bloğu. */
function alarmFrameBody(
  blockType: number,
  alarmType: number,
  slot: number,
  subslot: number,
): number[] {
  // BlockLength, BlockType+BlockLength'ten SONRAKİ baytları sayar (W
  // `dissect_block`: "block length includes the version") — ELLE yazılmaz,
  // gövdeden HESAPLANIR ki bir alan eklenince güncellemeyi unutmak imkansız olsun.
  const blockBody = [
    0x01, // BlockVersionHigh
    0x00, // BlockVersionLow
    ...uint16(alarmType),
    ...uint32(0x00000000), // API
    ...uint16(slot),
    ...uint16(subslot),
    ...uint32(0x00000101), // ModuleIdentNumber
    ...uint32(0x00000001), // SubmoduleIdentNumber
    ...uint16(0x0801), // AlarmSpecifier: sequence 1 + ChannelDiagnosis
    ...uint16(0x8000), // UserStructureIdentifier (yük yok)
  ];
  const block = [...uint16(blockType), ...uint16(blockBody.length), ...blockBody];
  return [
    ...uint16(0x0000), // AlarmDstEndpoint
    ...uint16(0x0001), // AlarmSrcEndpoint
    0x11, // PDUType: type 1 (Data-RTA), version 1
    0x11, // AddFlags: WindowSize 1, TACK 1
    ...uint16(0x0002), // SendSeqNum
    ...uint16(0xfffe), // AckSeqNum
    ...uint16(block.length), // VarPartLen
    ...block,
  ];
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'dcp-identify-request',
    name: 'protocol.profinet.example.dcpIdentifyRequest.name',
    bytes: buildFrame(
      DCP_IDENTIFY_MULTICAST_MAC,
      CONTROLLER_MAC,
      0xfefe,
      dcpPdu(0x05, 0x00, 0x01000001, 0x0100, DCP_IDENTIFY_REQUEST_BLOCKS),
      60,
    ),
    description: 'protocol.profinet.example.dcpIdentifyRequest.description',
    expectedValid: true,
  },
  {
    id: 'dcp-identify-response',
    name: 'protocol.profinet.example.dcpIdentifyResponse.name',
    bytes: buildFrame(
      CONTROLLER_MAC,
      DEVICE_MAC,
      0xfeff,
      dcpPdu(0x05, 0x01, 0x01000001, 0x0000, DCP_IDENTIFY_RESPONSE_BLOCKS),
    ),
    description: 'protocol.profinet.example.dcpIdentifyResponse.description',
    expectedValid: true,
  },
  {
    id: 'dcp-set-response-padding',
    name: 'protocol.profinet.example.dcpSetResponsePadding.name',
    bytes: buildFrame(
      CONTROLLER_MAC,
      DEVICE_MAC,
      0xfefd,
      dcpPdu(0x04, 0x01, 0x02000002, 0x0000, DCP_SET_RESPONSE_BLOCKS),
      60,
    ),
    description: 'protocol.profinet.example.dcpSetResponsePadding.description',
    expectedValid: true,
  },
  {
    id: 'dcp-get-request-selectors',
    name: 'protocol.profinet.example.dcpGetRequestSelectors.name',
    bytes: buildFrame(
      DEVICE_MAC,
      CONTROLLER_MAC,
      0xfefd,
      dcpPdu(0x03, 0x00, 0x03000003, 0x0000, DCP_GET_REQUEST_SELECTORS),
      60,
    ),
    description: 'protocol.profinet.example.dcpGetRequestSelectors.description',
    expectedValid: true,
  },
  {
    id: 'dcp-hello',
    name: 'protocol.profinet.example.dcpHello.name',
    bytes: buildFrame(
      DCP_HELLO_MULTICAST_MAC,
      DEVICE_MAC,
      0xfefc,
      dcpPdu(
        0x06,
        0x00,
        0x04000004,
        0x0000,
        dcpBlock(0x02, 0x02, [...BLOCK_INFO_ZERO, ...ascii('conveyor-io-01')]),
      ),
      60,
    ),
    description: 'protocol.profinet.example.dcpHello.description',
    expectedValid: true,
  },
  {
    id: 'rt-cyclic-io',
    name: 'protocol.profinet.example.rtCyclicIo.name',
    bytes: buildFrame(DEVICE_MAC, CONTROLLER_MAC, 0x8000, [
      ...CYCLIC_IO_DATA,
      ...CYCLIC_APDU_STATUS_OK,
    ]),
    description: 'protocol.profinet.example.rtCyclicIo.description',
    expectedValid: true,
  },
  {
    id: 'rt-cyclic-provider-stopped',
    name: 'protocol.profinet.example.rtCyclicProviderStopped.name',
    bytes: buildFrame(DEVICE_MAC, CONTROLLER_MAC, 0xbc01, [
      ...CYCLIC_IO_DATA,
      ...CYCLIC_APDU_STATUS_PROBLEM,
    ]),
    description: 'protocol.profinet.example.rtCyclicProviderStopped.description',
    expectedValid: true,
  },
  {
    id: 'alarm-low-diagnosis',
    name: 'protocol.profinet.example.alarmLowDiagnosis.name',
    bytes: buildFrame(
      CONTROLLER_MAC,
      DEVICE_MAC,
      0xfe01,
      alarmFrameBody(0x0002, 0x0001, 0x0001, 0x0001),
      60,
    ),
    description: 'protocol.profinet.example.alarmLowDiagnosis.description',
    expectedValid: true,
  },
  {
    id: 'alarm-high-plug',
    name: 'protocol.profinet.example.alarmHighPlug.name',
    bytes: buildFrame(
      CONTROLLER_MAC,
      DEVICE_MAC,
      0xfc01,
      alarmFrameBody(0x0001, 0x0004, 0x0002, 0x0001),
      60,
    ),
    description: 'protocol.profinet.example.alarmHighPlug.description',
    expectedValid: true,
  },
  {
    id: 'ptcp-announce',
    name: 'protocol.profinet.example.ptcpAnnounce.name',
    bytes: buildFrame(
      [0x01, 0x0e, 0xcf, 0x00, 0x01, 0x00],
      DEVICE_MAC,
      0xff00,
      new Array<number>(44).fill(0x00),
    ),
    description: 'protocol.profinet.example.ptcpAnnounce.description',
    expectedValid: true,
  },
  {
    id: 'ethertype-not-profinet',
    name: 'protocol.profinet.example.etherTypeNotProfinet.name',
    // Döngüsel örneğin aynısı, EtherType kasten 0x0800 (IPv4).
    bytes: Uint8Array.from([
      ...DEVICE_MAC,
      ...CONTROLLER_MAC,
      0x08,
      0x00,
      ...uint16(0x8000),
      ...CYCLIC_IO_DATA,
      ...CYCLIC_APDU_STATUS_OK,
    ]),
    description: 'protocol.profinet.example.etherTypeNotProfinet.description',
    expectedValid: false,
  },
  {
    id: 'dcp-block-truncated',
    name: 'protocol.profinet.example.dcpBlockTruncated.name',
    // DCPDataLength 32 bayt vaat eder, telde yalnız 8 bayt var.
    bytes: buildFrame(CONTROLLER_MAC, DEVICE_MAC, 0xfeff, [
      0x05,
      0x01,
      ...uint32(0x05000005),
      ...uint16(0x0000),
      ...uint16(32),
      0x02,
      0x02,
      ...uint16(4),
      ...BLOCK_INFO_ZERO,
      ...ascii('ab'),
    ]),
    description: 'protocol.profinet.example.dcpBlockTruncated.description',
    expectedValid: false,
  },
  {
    id: 'frame-too-short',
    name: 'protocol.profinet.example.frameTooShort.name',
    // 10 bayt: Ethernet başlığı bile tamamlanmıyor → ParseFailure.
    bytes: Uint8Array.from([...DEVICE_MAC, ...CONTROLLER_MAC.slice(0, 4)]),
    description: 'protocol.profinet.example.frameTooShort.description',
    expectedValid: false,
  },
];

export const profinetPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: profinetParser,
  documentation: {
    summary: 'protocol.profinet.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'Wireshark PROFINET dissector plugin (pn-rt / pn-dcp / pn-io) — field layout reference',
        url: 'https://github.com/wireshark/wireshark/tree/master/plugins/epan/profinet',
      },
      {
        title: 'p-net — PROFINET device stack by RT-Labs (documented constants referenced only)',
        url: 'https://github.com/rtlabs-com/p-net',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
