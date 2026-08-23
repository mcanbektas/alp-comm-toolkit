/**
 * POWERLINK (EPSG DS 301 / IEC 61784-2 CP 13) — IEEE 802.3 Fast Ethernet
 * üstünde sert gerçek zamanlı fieldbus. Girdi TAM BİR ETHERNET ÇERÇEVESİdir:
 * DST MAC + SRC MAC (+ opsiyonel VLAN tag'leri) + EtherType 0x88AB +
 * MessageType + Destination/Source Node ID + tipe göre değişen gövde
 * (+ Ethernet dolgusu).
 *
 * Faz 10, dalga 13f. `industrial-ethernet` ailesinin üçüncü `ready` kaydı.
 *
 * ── GİRDİ MODELİ — AİLE İÇİ TUTARLILIK ──────────────────────────────────────
 * `ethercat.ts` (5d) ve `profinet.ts` (13e) TAM Ethernet çerçevesi alır ve
 * `network/ethernet/ethernetFrame.ts`in dışa açılan yardımcılarını PAYLAŞIR
 * (`formatMac`, `classifyDestinationMac`, `walkTypeLengthChain`). POWERLINK de
 * AYNI ÇİZGİDE: POWERLINK IP'nin üstünde taşınan bir üst katman değil,
 * EtherType'ın DOĞRUDAN işaret ettiği çerçevenin kendisidir. İkinci bir MAC
 * biçimleyici ya da ikinci bir VLAN yürüyüşü YAZILMADI. 0x88AB
 * `ETHER_TYPE_NAMES`e de eklendi (dosyanın kendi kuralı: motoru OLAN her
 * EtherType orada adlandırılır ki "kendi sayfasında çöz" yönlendirmesi çalışsın).
 *
 * ── CANopen PAYLAŞIMI: SINANDI, (c) PAYLAŞIM YOK ────────────────────────────
 * Spec özeti (`docs/spec/ozet/03-endustriyel.md:107-111`) "CANopen benzeri
 * model … CANopen ile ortak OD engine paylaşılabilir" diyor. İDDİA SINANDI ve
 * BİT DÜZEYİNDE ÇÜRÜDÜ. Üç bağımsız kanıt:
 *
 *  1. **NMT durum baytları KESİŞMİYOR.** `canopen.ts` `NMT_STATE_LABELS`
 *     {0x00 Boot-up, 0x04 Stopped, 0x05 Operational, 0x7F Pre-operational}.
 *     POWERLINK'inki {0x00, 0x19, 0x29, 0x39, 0x1C, 0x1D, 0x1E, 0x4D, 0x5D,
 *     0x6D, 0xFD} (W `epl_nmt_cs_vals`, O `nmt.h` `tNmtState` alt baytı). Ortak
 *     görünen tek değer 0x00 ve ANLAMI FARKLI: CANopen'da "Boot-up",
 *     POWERLINK'te "NMT_GS_OFF". Ortak bir tablo, tam da dalga 12'nin
 *     LLDP/DHCP TLV vakasındaki gibi sessiz-yanlış etiket üretirdi.
 *  2. **SDO çerçeveleri farklı.** CANopen SDO'su TEK baytlık command
 *     specifier + Index(2) + SubIndex(1) + 4 bayt veri = 8 bayt (CAN
 *     çerçevesinin tamamı). POWERLINK'inki Sequence Layer (4 bayt) + Command
 *     Layer (8 bayt sabit başlık: reserved/TransactionID/Flags/CommandID/
 *     SegmentSize(2)/reserved(2)) + gövde. Ayrıntı `powerlinkSdo.ts` başında.
 *  3. **PDO BOYUT SINIRI GERÇEKTEN FARKLI — brief'in tahmini DOĞRULANDI.**
 *     CANopen PDO'sunun uzunluğu CAN başlığındaki DLC'dir, ≤ 8 bayt, ve
 *     çerçevede AYRI BİR UZUNLUK ALANI YOKTUR. POWERLINK PReq/PRes'te
 *     uzunluk 16-BİTLİK, LITTLE-ENDIAN, ÇERÇEVEDE YAZAN bir `Size` alanıdır
 *     (ofset 22; O `tPreqFrame.sizeLe`/`tPresFrame.sizeLe`, W
 *     `hf_epl_preq_size`/`hf_epl_pres_size`) ve tavan
 *     `C_DLL_MAX_PAYL_OFFSET 1499`dur. Ortak bir "OD/PDO motoru" ya 8 baytlık
 *     varsayımı POWERLINK'e taşırdı ya da CANopen'a olmayan bir uzunluk alanı
 *     uydururdu.
 *
 * GERÇEKTEN ORTAK OLAN TEK ŞEY, OD adreslemesinin 16-bit Index + 8-bit
 * Sub-index olmasıdır — iki satırlık bir okuma. Onun için modül açmak ya da
 * `canopen.ts`i refactor etmek dalga 12'nin "spekülatif ortak modül açma"
 * dersine aykırı olurdu. **`canopen.ts`e HİÇ DOKUNULMADI**; oradaki iç
 * fonksiyonlar private kaldı, mevcut testleri değişmedi.
 *
 * ── KAYNAK UYARISI ──────────────────────────────────────────────────────────
 * EPSG DS 301'in resmi metni bu depoda YOKTUR. Alan yerleşimleri İKİ bağımsız,
 * kamuya açık kaynaktan ÇAPRAZ TEYİTLE alındı (ikisine de bu oturumda gerçekten
 * erişildi; KOD KOPYALANMADI):
 *   W = **Wireshark EPL dissector'ı** (GPL-2.0-or-later)
 *       `epan/dissectors/packet-epl.c`; `epan/etypes.h` `ETHERTYPE_EPL_V2 0x88AB`.
 *       https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-epl.c
 *   O = **openPOWERLINK V2** (B&R/Kalycito, açık kaynak referans yığın; yalnız
 *       dokümante sabitler referans alındı) `stack/include/oplk/{frame.h,nmt.h,
 *       oplkdefs.h}`, `stack/include/user/sdocomint.h`.
 *       https://github.com/OpenAutomationTechnologies/openPOWERLINK_V2
 * ÜÇÜNCÜ, BAĞIMSIZ TEYİT: **IEEE EtherType kayıt defteri** 0x88AB'yi
 * "B&R Industrial Automation GmbH — ETHERNET Powerlink (EPL)" olarak listeler.
 * https://standards-oui.ieee.org/ethertype/eth.txt
 *
 * Çerçeve ofsetleri iki kaynakta BİREBİR: O `PLK_FRAME_OFFSET_{MSG_TYPE 14,
 * DST_NODEID 15, SRC_NODEID 16, SDO_SEQU 18, SDO_COMU 22, PDO_PAYLOAD 24}`;
 * W `EPL_{MTYP,DEST,SRC}_OFFSET {0,1,2}` (EPL gövdesine göreli, +14 Ethernet).
 *
 * TEYİT EDİLEMEYEN ADLANDIRILMADI (`ethercat.ts`in 0xFF/"EXT" emsali):
 * SoA'nın DNA AN bitleri (W 0x08/0x10) ve ring-redundancy bayrakları, SDO
 * komut 0x71, IdentResponse'un FeatureFlags bit adları — hepsi yalnız W'de.
 * IdentResponse'un IP alanlarında iki kaynak BAYT SIRASINDA ÇAKIŞIYOR; o üç
 * alan ham bırakıldı (gerekçe `powerlinkAsnd.ts` dosya başında).
 *
 * ── STATUS: 'ready' — GEREKÇE (`ethercat.ts` ölçütü) ────────────────────────
 * Ham kalan tek bölgeler PDO YÜKÜ ve NMT/SDO KOMUT VERİSİdir; ikisi de YAPISAL
 * bir eksik değil, TANIM-BAĞIMLI içeriktir: bir PReq/PRes yükünün hangi baytının
 * hangi objeye karşılık geldiği XDD (ya da MN'nin PDO eşlemesi) ile belirlenir
 * ve TEK ÇERÇEVEDEN çıkarılamaz — `ethercat.ts`in datagram verisi ve
 * `profinet.ts`in IO Data'sıyla aynı sınıf. Buna karşılık çerçevenin YAPISAL
 * alanlarının hepsi çözülür: MessageType, iki node adresi, her mesaj tipinin
 * tüm bayrak bitleri, NetTime/RelativeTime, PDOVersion, 16-bit Size, NMT durum
 * baytı, ASnd'in altı servisi, SDO'nun iki katmanı ve abort kodu. POWERLINK'in
 * KENDİ tanımladığı bir çerçeve checksum'ı YOKTUR (o iş Ethernet FCS'inindir) —
 * dolayısıyla atlanan bir doğrulama da yoktur. MAVLink'in `partial` gerekçesi
 * (protokolün kendi tanımladığı bir doğrulama dialect olmadan yapılamıyor)
 * burada GEÇERSİZDİR.
 *
 * ── decodeOptions: AÇILMADI, GEREKÇESİ ──────────────────────────────────────
 *  1. "PDO yükü kaç bayt" → ÇERÇEVEDE YAZAR (`Size`, ofset 22). Kanal gereksiz
 *     olurdu (dalga 12f'nin WebSocket MASK-biti dersi).
 *  2. "Bu node MN mi CN mi" (NMT durumunun MS_/CS_ öneki) → KAYNAK NODE
 *     ADRESİNDEN çıkar: 240 = MN. İki kaynak da tam olarak bunu yapıyor
 *     (W `pinfo->srcport != EPL_MN_NODEID`). Kanal gereksiz.
 *  3. "PDO eşlemesi" (hangi bayt hangi obje) → bir `select`/`number` alanına
 *     SIĞMAZ; XDD ağacı ister. Yarım bir kanal yanlış kırılıma davet olurdu
 *     (`profinet.ts`in GSDML gerekçesinin aynısı).
 *
 * ── KAPSAM DIŞI (dosya başında AÇIKÇA) ──────────────────────────────────────
 *  • **SDO via UDP/IP** ve **SDO via PDO**: bu motorun girdisi HAM ETHERNET
 *    çerçevesidir; UDP yolu ayrı bir tel biçimidir (O `tSdoType`
 *    `kSdoTypeUdp`/`kSdoTypePdo`). Yalnız "SDO via ASnd" çözülür.
 *  • **XDD** (XML cihaz tanımı): katalog kaydının `definitions` sekmesi YOK ve
 *    domain dosyasının başlık yorumu XDD'nin `DEFINITION_FORMATS`ta karşılığı
 *    olmadığını söylüyor — ayrıştırıcı bu dalganın kapsamı değil.
 *  • **Çok çerçeveli analiz**: cycle timing/jitter, node tablosu, NMT durum
 *    çizelgesi, SDO segment yeniden birleştirme — `ethercat.ts`in "analyzer
 *    sınırı" emsali. Bu motor tek çerçevenin alanlarını verir.
 *  • **Ethernet Powerlink V1** (EtherType 0x3E3F): ayrı ve eski bir tel biçimi
 *    (W'nin `packet-epl_v1.c`si ayrı bir dissector). Kapsam dışı.
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

import { decodeAsndPdu, pushNmtStateField } from './powerlinkAsnd';
import {
  NODE_ID_MN,
  byteAt,
  describeNodeId,
  formatHex,
  formatVersionNibbles,
  pushBitField,
  pushMaskedField,
  pushNumericField,
  pushRawBlock,
  readUint16Le,
  readUint32Le,
  readUint64Le,
} from './powerlinkFields';

/** Katalogdaki kayıt id'siyle birebir aynı olmalı — plugin bağı budur. */
const PROTOCOL_ID = 'powerlink';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'POWERLINK';

/** W `ETHERTYPE_EPL_V2`, O `C_DLL_ETHERTYPE_EPL`, IEEE kayıt defteri. */
const POWERLINK_ETHER_TYPE = 0x88ab;

/** MessageType(1) + Destination Node ID(1) + Source Node ID(1). */
const BASIC_HEADER_LENGTH = 3;
/** VLAN'lı varyantta tip alanı bir tag kadar ilerideki ofsettedir. */
const VLAN_TAG_LENGTH = 4;

/** W `tvb_get_uint8(...) & 0x7F` — bit 7 MessageType'ın parçası DEĞİL. */
const MESSAGE_TYPE_MASK = 0x7f;
const MESSAGE_TYPE_HIGH_BIT = 0x80;

const MSG_TYPE_SOC = 0x01;
const MSG_TYPE_PREQ = 0x03;
const MSG_TYPE_PRES = 0x04;
const MSG_TYPE_SOA = 0x05;
const MSG_TYPE_ASND = 0x06;
const MSG_TYPE_AMNI = 0x07;
const MSG_TYPE_AINV = 0x0d;

/** İki kaynakta birebir (W `mtyp_vals`, O `tMsgType`). */
const MESSAGE_TYPE_LABELS: ReadonlyMap<number, string> = new Map([
  [MSG_TYPE_SOC, 'Start of Cycle (SoC)'],
  [MSG_TYPE_PREQ, 'PollRequest (PReq)'],
  [MSG_TYPE_PRES, 'PollResponse (PRes)'],
  [MSG_TYPE_SOA, 'Start of Asynchronous (SoA)'],
  [MSG_TYPE_ASND, 'Asynchronous Send (ASnd)'],
  [MSG_TYPE_AMNI, 'Active Managing Node Indication (AMNI)'],
  [MSG_TYPE_AINV, 'Asynchronous Invite (AInv)'],
]);

/** SoA'nın istediği asenkron servis (W `soa_svid_vals`; O ASnd kümesiyle eşleşir). */
const SOA_SERVICE_LABELS: ReadonlyMap<number, string> = new Map([
  [0x00, 'NoService'],
  [0x01, 'IdentRequest'],
  [0x02, 'StatusRequest'],
  [0x03, 'NMTRequestInvite'],
  [0x06, 'SyncRequest'],
  [0xff, 'UnspecifiedInvite'],
]);

/** SoC bayrakları (O `PLK_FRAME_FLAG1_{MC,PS}`, W `EPL_SOC_{MC,PS}_MASK`). */
const SOC_MC_MASK = 0x80;
const SOC_PS_MASK = 0x40;
/** PReq/PRes bayrakları (O `PLK_FRAME_FLAG1_*`, W `EPL_PDO_*_MASK`). */
const PDO_RD_MASK = 0x01;
const PDO_EA_MASK = 0x04;
const PDO_EN_MASK = 0x10;
const PDO_MS_MASK = 0x20;
const PDO_RS_MASK = 0x07;
const PDO_PR_MASK = 0x38;
const PDO_PR_SHIFT = 3;
const PDO_SLS_MASK = 0x40;
const PDO_FLS_MASK = 0x80;
/** SoA bayrakları (O `PLK_FRAME_FLAG1_{EA,ER}`, W `EPL_SOA_{EA,ER}_MASK`). */
const SOA_EA_MASK = 0x04;
const SOA_ER_MASK = 0x02;

export const ERROR_FRAME_TOO_SHORT = 'protocol.powerlink.error.frameTooShort';
export const ERROR_FRAME_TOO_LONG = 'protocol.powerlink.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.powerlink.error.aborted';
export const ERROR_ETHER_TYPE_NOT_POWERLINK = 'protocol.powerlink.error.etherTypeNotPowerlink';
export const ERROR_BASIC_HEADER_TRUNCATED = 'protocol.powerlink.error.basicHeaderTruncated';
export const ERROR_PDO_HEADER_TRUNCATED = 'protocol.powerlink.error.pdoHeaderTruncated';

export const WARN_MESSAGE_TYPE_NOT_NAMED = 'protocol.powerlink.warning.messageTypeNotNamed';
export const WARN_MESSAGE_TYPE_HIGH_BIT_SET = 'protocol.powerlink.warning.messageTypeHighBitSet';
export const WARN_PDO_PAYLOAD_NEEDS_MAPPING = 'protocol.powerlink.warning.pdoPayloadNeedsMapping';
export const WARN_PDO_SIZE_EXCEEDS_FRAME = 'protocol.powerlink.warning.pdoSizeExceedsFrame';
export const WARN_SOA_SERVICE_NOT_NAMED = 'protocol.powerlink.warning.soaServiceNotNamed';
export const WARN_SOA_FLAGS_PARTIALLY_NAMED = 'protocol.powerlink.warning.soaFlagsPartiallyNamed';
export const WARN_BODY_NOT_DECODED = 'protocol.powerlink.warning.bodyNotDecoded';
export const WARN_PADDING_NOT_ZERO = 'protocol.powerlink.warning.paddingNotZero';

const SUMMARY_SOC = 'protocol.powerlink.summary.soc';
const SUMMARY_PDO = 'protocol.powerlink.summary.pdo';
const SUMMARY_SOA = 'protocol.powerlink.summary.soa';
const SUMMARY_ASND = 'protocol.powerlink.summary.asnd';
const SUMMARY_OTHER = 'protocol.powerlink.summary.other';
const SUMMARY_NOT_POWERLINK = 'protocol.powerlink.summary.notPowerlink';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/**
 * Frame düzeyindeki uyarıları TEKRARSIZ biriktirir: aynı not alan düzeyinde
 * birden çok kez basılabilir ama frame rozetinde bir kez görünmelidir
 * (`ethercat.ts`/`profinet.ts` `WarningSink` deseni).
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

export type PowerlinkFrameMetadata = {
  /** EtherType yanlışsa `undefined`. */
  messageType: number | undefined;
  messageClass: string;
  sourceNodeId: number | undefined;
  destinationNodeId: number | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface PowerlinkParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

/**
 * Bildirilen bölgeden sonra kalan baytlar Ethernet'in 60 baytlık asgari çerçeve
 * boyu için eklenen DOLGUdur. Sıfırdan farklıysa uyarı: dolgu olmayan bir şeyi
 * dolgu diye göstermemek için (`ethercat.ts` emsali).
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

/** SoC gövdesi: reserved(1) + flags(1) + reserved(1) + NetTime(8) + RelativeTime(8). */
function decodeSocBody(data: Uint8Array, bodyStart: number, fields: ParsedField[]): number {
  pushRawBlock(fields, data, {
    id: `soc-reserved-${bodyStart}`,
    name: 'SoC — Reserved',
    offset: bodyStart,
    length: 1,
  });

  const flagsOffset = bodyStart + 1;
  const flags = byteAt(data, flagsOffset);
  pushBitField(fields, data, {
    id: `soc-flag-mc-${flagsOffset}`,
    name: 'SoC — MC (multiplexed cycle completed)',
    offset: flagsOffset,
    value: flags,
    mask: SOC_MC_MASK,
    onLabel: 'Set',
    offLabel: 'Not set',
  });
  pushBitField(fields, data, {
    id: `soc-flag-ps-${flagsOffset}`,
    name: 'SoC — PS (prescaled slot)',
    offset: flagsOffset,
    value: flags,
    mask: SOC_PS_MASK,
    onLabel: 'Set',
    offLabel: 'Not set',
  });

  pushRawBlock(fields, data, {
    id: `soc-reserved2-${bodyStart + 2}`,
    name: 'SoC — Reserved',
    offset: bodyStart + 2,
    length: 1,
  });

  // NetTime = tNetTime {seconds U32 LE, nanoseconds U32 LE}; iki kaynak da
  // 8 baytlık iki parçalı okuma yapıyor.
  pushNumericField(fields, data, {
    id: `soc-nettime-seconds-${bodyStart + 3}`,
    name: 'SoC — NetTime seconds',
    offset: bodyStart + 3,
    length: 4,
    unit: 's',
  });
  pushNumericField(fields, data, {
    id: `soc-nettime-nanoseconds-${bodyStart + 7}`,
    name: 'SoC — NetTime nanoseconds',
    offset: bodyStart + 7,
    length: 4,
    unit: 'ns',
  });

  // RelativeTime her cycle'da cycle süresi kadar artan MİKROSANİYE sayacıdır
  // ve 64 bittir: `number`ın güvenli tamsayı sınırını aşabilir → `bigint`.
  const relativeOffset = bodyStart + 11;
  const relative = readUint64Le(data, relativeOffset);
  fields.push({
    id: `soc-relative-time-${relativeOffset}`,
    name: 'SoC — RelativeTime',
    offset: relativeOffset,
    length: 8,
    rawBytes: data.slice(relativeOffset, relativeOffset + 8),
    rawValue: relative,
    physicalValue: relative.toString(),
    unit: 'µs',
    valid: true,
    warnings: [],
  });

  return relativeOffset + 8;
}

interface PdoOutcome {
  readonly end: number;
  readonly size: number;
  readonly pdoVersion: number;
}

/**
 * PReq ve PRes aynı iskeleti paylaşır; ayrım ilk baytta (PReq'te reserved,
 * PRes'te NMTStatus) ve bayrak kümelerindedir. `Size` alanı BU AİLENİN
 * CANopen'dan en net ayrıldığı yer: uzunluk çerçevede YAZAR ve 16 bittir.
 */
function decodePdoBody(
  data: Uint8Array,
  bodyStart: number,
  isPollResponse: boolean,
  sourceIsManagingNode: boolean,
  fields: ParsedField[],
  warnings: WarningSink,
  errors: ProtocolError[],
): PdoOutcome | undefined {
  // reserved/NMTStatus(1) + flags(1) + flags2(1) + PDOVersion(1) + rsvd(1) + Size(2)
  const headerLength = 7;
  if (data.length - bodyStart < headerLength) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_PDO_HEADER_TRUNCATED,
      offset: bodyStart,
      length: Math.max(0, data.length - bodyStart),
      details: {
        availableBytes: Math.max(0, data.length - bodyStart),
        requiredBytes: headerLength,
      },
    });
    return undefined;
  }

  if (isPollResponse) {
    pushNmtStateField(
      data,
      bodyStart,
      sourceIsManagingNode,
      fields,
      warnings.buffer,
      `pres-nmt-status-${bodyStart}`,
      'PRes — NMTStatus',
    );
    warnings.drain();
  } else {
    pushRawBlock(fields, data, {
      id: `preq-reserved-${bodyStart}`,
      name: 'PReq — Reserved',
      offset: bodyStart,
      length: 1,
    });
  }

  const prefix = isPollResponse ? 'PRes' : 'PReq';
  const flagsOffset = bodyStart + 1;
  const flags = byteAt(data, flagsOffset);
  pushBitField(fields, data, {
    id: `pdo-flag-ms-${flagsOffset}`,
    name: `${prefix} — MS (multiplexed slot)`,
    offset: flagsOffset,
    value: flags,
    mask: PDO_MS_MASK,
    onLabel: 'Set',
    offLabel: 'Not set',
  });
  if (isPollResponse) {
    pushBitField(fields, data, {
      id: `pdo-flag-en-${flagsOffset}`,
      name: 'PRes — EN (exception new)',
      offset: flagsOffset,
      value: flags,
      mask: PDO_EN_MASK,
      onLabel: 'Set',
      offLabel: 'Not set',
    });
  } else {
    pushBitField(fields, data, {
      id: `pdo-flag-ea-${flagsOffset}`,
      name: 'PReq — EA (exception acknowledge)',
      offset: flagsOffset,
      value: flags,
      mask: PDO_EA_MASK,
      onLabel: 'Set',
      offLabel: 'Not set',
    });
  }
  pushBitField(fields, data, {
    id: `pdo-flag-rd-${flagsOffset}`,
    name: `${prefix} — RD (ready)`,
    offset: flagsOffset,
    value: flags,
    mask: PDO_RD_MASK,
    onLabel: 'Data valid',
    offLabel: 'Data invalid',
  });

  const flags2Offset = bodyStart + 2;
  const flags2 = byteAt(data, flags2Offset);
  pushBitField(fields, data, {
    id: `pdo-flag-fls-${flags2Offset}`,
    name: `${prefix} — FLS (first valid loss)`,
    offset: flags2Offset,
    value: flags2,
    mask: PDO_FLS_MASK,
    onLabel: 'Set',
    offLabel: 'Not set',
  });
  pushBitField(fields, data, {
    id: `pdo-flag-sls-${flags2Offset}`,
    name: `${prefix} — SLS (second valid loss)`,
    offset: flags2Offset,
    value: flags2,
    mask: PDO_SLS_MASK,
    onLabel: 'Set',
    offLabel: 'Not set',
  });
  if (isPollResponse) {
    pushMaskedField(fields, data, {
      id: `pdo-flag-pr-${flags2Offset}`,
      name: 'PRes — PR (priority of requested asynchronous frame)',
      offset: flags2Offset,
      value: flags2,
      mask: PDO_PR_MASK,
      shift: PDO_PR_SHIFT,
    });
    pushMaskedField(fields, data, {
      id: `pdo-flag-rs-${flags2Offset}`,
      name: 'PRes — RS (pending requests to send)',
      offset: flags2Offset,
      value: flags2,
      mask: PDO_RS_MASK,
      shift: 0,
    });
  }

  const versionOffset = bodyStart + 3;
  const pdoVersion = byteAt(data, versionOffset);
  pushNumericField(fields, data, {
    id: `pdo-version-${versionOffset}`,
    name: `${prefix} — PDOVersion`,
    offset: versionOffset,
    length: 1,
    physicalValue: formatVersionNibbles(pdoVersion),
  });
  pushRawBlock(fields, data, {
    id: `pdo-reserved-${bodyStart + 4}`,
    name: `${prefix} — Reserved`,
    offset: bodyStart + 4,
    length: 1,
  });

  const sizeOffset = bodyStart + 5;
  const size = readUint16Le(data, sizeOffset);
  const payloadStart = sizeOffset + 2;
  const available = data.length - payloadStart;
  const sizeWarnings: string[] = [];
  if (size > available) {
    // Bildirilen boy telde OLANDAN büyük — çerçeve kesik ya da Size bozuk.
    sizeWarnings.push(WARN_PDO_SIZE_EXCEEDS_FRAME);
    warnings.push(WARN_PDO_SIZE_EXCEEDS_FRAME);
  }
  pushNumericField(fields, data, {
    id: `pdo-size-${sizeOffset}`,
    name: `${prefix} — Size`,
    offset: sizeOffset,
    length: 2,
    unit: 'B',
    warnings: sizeWarnings,
  });

  const payloadLength = Math.min(size, Math.max(0, available));
  if (payloadLength > 0) {
    // Yükün hangi baytının hangi objeye karşılık geldiği PDO EŞLEMESİnden
    // (XDD / MN konfigürasyonu) gelir, çerçeveden DEĞİL. Uydurma bir kırılım
    // basmak yasak — tek parça ham + gerekçe.
    pushRawBlock(fields, data, {
      id: `pdo-payload-${payloadStart}`,
      name: `${prefix} — PDO Payload`,
      offset: payloadStart,
      length: payloadLength,
      warnings: [WARN_PDO_PAYLOAD_NEEDS_MAPPING],
    });
    warnings.push(WARN_PDO_PAYLOAD_NEEDS_MAPPING);
  }

  return { end: payloadStart + payloadLength, size, pdoVersion };
}

interface SoaOutcome {
  readonly end: number;
  readonly serviceId: number;
  readonly serviceLabel: string;
  readonly target: number;
}

function decodeSoaBody(
  data: Uint8Array,
  bodyStart: number,
  sourceIsManagingNode: boolean,
  fields: ParsedField[],
  warnings: WarningSink,
): SoaOutcome {
  pushNmtStateField(
    data,
    bodyStart,
    sourceIsManagingNode,
    fields,
    warnings.buffer,
    `soa-nmt-status-${bodyStart}`,
    'SoA — NMTStatus',
  );
  warnings.drain();

  const flagsOffset = bodyStart + 1;
  const flags = byteAt(data, flagsOffset);
  pushBitField(fields, data, {
    id: `soa-flag-ea-${flagsOffset}`,
    name: 'SoA — EA (exception acknowledge)',
    offset: flagsOffset,
    value: flags,
    mask: SOA_EA_MASK,
    onLabel: 'Set',
    offLabel: 'Not set',
  });
  pushBitField(fields, data, {
    id: `soa-flag-er-${flagsOffset}`,
    name: 'SoA — ER (exception reset)',
    offset: flagsOffset,
    value: flags,
    mask: SOA_ER_MASK,
    onLabel: 'Set',
    offLabel: 'Not set',
  });
  // Bu baytın kalan bitleri (DNA AN local/global) yalnız W'de adlandırılıyor;
  // O'nun `PLK_FRAME_FLAG1` listesinde yok → adlandırılmaz, uyarılır.
  warnings.push(WARN_SOA_FLAGS_PARTIALLY_NAMED);

  pushRawBlock(fields, data, {
    id: `soa-reserved-${bodyStart + 2}`,
    name: 'SoA — Reserved',
    offset: bodyStart + 2,
    length: 1,
  });

  const serviceOffset = bodyStart + 3;
  const serviceId = byteAt(data, serviceOffset);
  const serviceLabel = SOA_SERVICE_LABELS.get(serviceId);
  const serviceField: ParsedField = {
    id: `soa-requested-service-id-${serviceOffset}`,
    name: 'SoA — RequestedServiceID',
    offset: serviceOffset,
    length: 1,
    rawBytes: data.slice(serviceOffset, serviceOffset + 1),
    rawValue: serviceId,
    physicalValue:
      serviceLabel ??
      (serviceId >= 0xa0 && serviceId <= 0xfe ? 'Manufacturer specific' : formatHex(serviceId, 2)),
    valid: serviceLabel !== undefined,
    warnings: [],
  };
  if (serviceLabel === undefined) {
    serviceField.warnings.push(WARN_SOA_SERVICE_NOT_NAMED);
    warnings.push(WARN_SOA_SERVICE_NOT_NAMED);
  }
  fields.push(serviceField);

  const targetOffset = bodyStart + 4;
  const target = byteAt(data, targetOffset);
  pushNumericField(fields, data, {
    id: `soa-requested-service-target-${targetOffset}`,
    name: 'SoA — RequestedServiceTarget',
    offset: targetOffset,
    length: 1,
    physicalValue: describeNodeId(target),
  });

  const versionOffset = bodyStart + 5;
  const version = byteAt(data, versionOffset);
  pushNumericField(fields, data, {
    id: `soa-powerlink-version-${versionOffset}`,
    name: 'SoA — POWERLINKVersion',
    offset: versionOffset,
    length: 1,
    physicalValue: formatVersionNibbles(version),
  });

  // Ring-redundancy bayrakları yalnız W'de adlandırılıyor (O yalnız
  // `flag3`in MR bitini biliyor) → bayt ham basılır.
  pushRawBlock(fields, data, {
    id: `soa-rr-flags-${bodyStart + 6}`,
    name: 'SoA — RRFlags',
    offset: bodyStart + 6,
    length: 1,
  });

  let end = bodyStart + 7;
  if (serviceId === 0x06) {
    end = decodeSyncRequest(data, end, fields);
  }
  return { end, serviceId, serviceLabel: serviceLabel ?? formatHex(serviceId, 2), target };
}

/**
 * SoA'nın SyncRequest yükü (PollResponse Chaining). İki kaynakta BİREBİR:
 * O `tSyncRequest` alan sırası; W `EPL_SOA_{SYNC 10, PRFE 14, PRSE 18,
 * MNDF 22, MNDS 26, PRTO 30, DEST 34}_OFFSET` (EPL gövdesine göreli).
 */
function decodeSyncRequest(data: Uint8Array, start: number, fields: ParsedField[]): number {
  if (start + 4 > data.length) return start;
  const control = readUint32Le(data, start);
  pushNumericField(fields, data, {
    id: `soa-sync-control-${start}`,
    name: 'SyncRequest — SyncControl',
    offset: start,
    length: 4,
    physicalValue: formatHex(control, 8),
  });

  const numeric: ReadonlyArray<{ readonly id: string; readonly name: string; readonly delta: number }> =
    [
      { id: 'pres-time-first', name: 'PResTimeFirst', delta: 4 },
      { id: 'pres-time-second', name: 'PResTimeSecond', delta: 8 },
      { id: 'sync-mn-delay-first', name: 'SyncMNDelayFirst', delta: 12 },
      { id: 'sync-mn-delay-second', name: 'SyncMNDelaySecond', delta: 16 },
      { id: 'pres-fallback-timeout', name: 'PResFallBackTimeout', delta: 20 },
    ];
  let cursor = start + 4;
  for (const entry of numeric) {
    const offset = start + entry.delta;
    if (offset + 4 > data.length) return cursor;
    pushNumericField(fields, data, {
      id: `soa-sync-${entry.id}-${offset}`,
      name: `SyncRequest — ${entry.name}`,
      offset,
      length: 4,
      unit: 'ns',
    });
    cursor = offset + 4;
  }

  const macOffset = start + 24;
  if (macOffset + MAC_LENGTH > data.length) return cursor;
  const macBytes = data.slice(macOffset, macOffset + MAC_LENGTH);
  fields.push({
    id: `soa-sync-destination-mac-${macOffset}`,
    name: 'SyncRequest — DestMacAddress',
    offset: macOffset,
    length: MAC_LENGTH,
    rawBytes: macBytes,
    rawValue: formatMac(macBytes),
    valid: true,
    warnings: [],
  });
  return macOffset + MAC_LENGTH;
}

function buildResult(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: WarningSink,
  errors: ProtocolError[],
  metadata: PowerlinkFrameMetadata,
  options: PowerlinkParseOptions,
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

function parsePowerlinkFrame(data: Uint8Array, options: PowerlinkParseOptions): ParseResult {
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

  if (data.length < MIN_HEADER_LENGTH + BASIC_HEADER_LENGTH) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_FRAME_TOO_SHORT,
      recoverable: true,
      offset: 0,
      length: data.length,
      details: {
        availableBytes: data.length,
        requiredBytes: MIN_HEADER_LENGTH + BASIC_HEADER_LENGTH,
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
  const unknownMetadata: PowerlinkFrameMetadata = {
    messageType: undefined,
    messageClass: 'unknown',
    sourceNodeId: undefined,
    destinationNodeId: undefined,
    summaryKey: SUMMARY_NOT_POWERLINK,
    summaryParams,
  };

  if (etherType === undefined) {
    // walkTypeLengthChain hatayı zaten bastı (kesik tip alanı / kesik VLAN tag).
    return buildResult(data, fields, warnings, errors, unknownMetadata, options);
  }

  const etherTypeOffset = chain.cursor - TYPE_LENGTH_FIELD_LENGTH;
  const etherTypeMatches = etherType === POWERLINK_ETHER_TYPE;
  fields.push({
    id: 'ethertype',
    name: 'EtherType',
    offset: etherTypeOffset,
    length: TYPE_LENGTH_FIELD_LENGTH,
    rawBytes: data.slice(etherTypeOffset, chain.cursor),
    rawValue: etherType,
    physicalValue: etherTypeMatches ? 'POWERLINK (EPL V2)' : formatHex(etherType, 4),
    valid: etherTypeMatches,
    warnings: etherTypeMatches ? [] : [ERROR_ETHER_TYPE_NOT_POWERLINK],
  });

  if (!etherTypeMatches) {
    // Bu çerçeve POWERLINK DEĞİL. Ethernet alanları çözüldü, gövdeye
    // DOKUNULMAZ — yanlış EtherType'ta MessageType çözmek sessiz-yanlış
    // decode'un ta kendisi olurdu (`ethercat.ts`/`profinet.ts` emsali).
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_ETHER_TYPE_NOT_POWERLINK,
      offset: etherTypeOffset,
      length: TYPE_LENGTH_FIELD_LENGTH,
      details: {
        etherType: formatHex(etherType, 4),
        expected: formatHex(POWERLINK_ETHER_TYPE, 4),
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
        warnings: [ERROR_ETHER_TYPE_NOT_POWERLINK],
      });
    }
    summaryParams['etherType'] = formatHex(etherType, 4);
    return buildResult(data, fields, warnings, errors, unknownMetadata, options);
  }

  const headerStart = chain.cursor;
  if (data.length - headerStart < BASIC_HEADER_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_BASIC_HEADER_TRUNCATED,
      offset: headerStart,
      length: data.length - headerStart,
    });
    return buildResult(data, fields, warnings, errors, unknownMetadata, options);
  }

  const messageTypeByte = byteAt(data, headerStart);
  const messageType = messageTypeByte & MESSAGE_TYPE_MASK;
  const messageLabel = MESSAGE_TYPE_LABELS.get(messageType);
  const messageField: ParsedField = {
    id: 'message-type',
    name: 'MessageType',
    offset: headerStart,
    length: 1,
    rawBytes: data.slice(headerStart, headerStart + 1),
    rawValue: messageType,
    physicalValue: messageLabel ?? formatHex(messageType, 2),
    valid: messageLabel !== undefined,
    warnings: [],
  };
  if (messageLabel === undefined) {
    messageField.warnings.push(WARN_MESSAGE_TYPE_NOT_NAMED);
    warnings.push(WARN_MESSAGE_TYPE_NOT_NAMED);
  }
  if ((messageTypeByte & MESSAGE_TYPE_HIGH_BIT) !== 0) {
    // W bu biti maskeliyor (0x7F), O ise MessageType'ı tam bayt sayıyor —
    // ayrımı sessizce yutmak yerine söyleriz.
    messageField.warnings.push(WARN_MESSAGE_TYPE_HIGH_BIT_SET);
    warnings.push(WARN_MESSAGE_TYPE_HIGH_BIT_SET);
  }
  fields.push(messageField);

  const destinationNodeOffset = headerStart + 1;
  const destinationNodeId = byteAt(data, destinationNodeOffset);
  pushNumericField(fields, data, {
    id: 'destination-node-id',
    name: 'Destination Node ID',
    offset: destinationNodeOffset,
    length: 1,
    physicalValue: describeNodeId(destinationNodeId),
  });

  const sourceNodeOffset = headerStart + 2;
  const sourceNodeId = byteAt(data, sourceNodeOffset);
  pushNumericField(fields, data, {
    id: 'source-node-id',
    name: 'Source Node ID',
    offset: sourceNodeOffset,
    length: 1,
    physicalValue: describeNodeId(sourceNodeId),
  });

  summaryParams['messageType'] = messageLabel ?? formatHex(messageType, 2);
  summaryParams['sourceNodeId'] = String(sourceNodeId);
  summaryParams['destinationNodeId'] = String(destinationNodeId);

  // MN/CN ayrımı çerçevede AYRI BİR ALAN DEĞİL: kaynak adresi 240 ise MN.
  // İki kaynak da tam olarak bunu yapıyor (decodeOptions gerekçesi 2).
  const sourceIsManagingNode = sourceNodeId === NODE_ID_MN;

  const bodyStart = headerStart + BASIC_HEADER_LENGTH;
  let summaryKey = SUMMARY_OTHER;
  let messageClass = 'other';
  let consumedEnd = bodyStart;

  if (messageType === MSG_TYPE_SOC) {
    messageClass = 'soc';
    summaryKey = SUMMARY_SOC;
    consumedEnd = decodeSocBody(data, bodyStart, fields);
  } else if (messageType === MSG_TYPE_PREQ || messageType === MSG_TYPE_PRES) {
    messageClass = messageType === MSG_TYPE_PRES ? 'pres' : 'preq';
    summaryKey = SUMMARY_PDO;
    const outcome = decodePdoBody(
      data,
      bodyStart,
      messageType === MSG_TYPE_PRES,
      sourceIsManagingNode,
      fields,
      warnings,
      errors,
    );
    if (outcome === undefined) {
      return buildResult(
        data,
        fields,
        warnings,
        errors,
        {
          messageType,
          messageClass,
          sourceNodeId,
          destinationNodeId,
          summaryKey,
          summaryParams,
        },
        options,
      );
    }
    consumedEnd = outcome.end;
    summaryParams['size'] = String(outcome.size);
    summaryParams['pdoVersion'] = formatVersionNibbles(outcome.pdoVersion);
  } else if (messageType === MSG_TYPE_SOA) {
    messageClass = 'soa';
    summaryKey = SUMMARY_SOA;
    const outcome = decodeSoaBody(data, bodyStart, sourceIsManagingNode, fields, warnings);
    consumedEnd = outcome.end;
    summaryParams['service'] = outcome.serviceLabel;
    summaryParams['target'] = String(outcome.target);
  } else if (messageType === MSG_TYPE_ASND) {
    messageClass = 'asnd';
    summaryKey = SUMMARY_ASND;
    const outcome = decodeAsndPdu(
      data,
      bodyStart,
      data.length,
      sourceIsManagingNode,
      fields,
      warnings.buffer,
      errors,
    );
    warnings.drain();
    consumedEnd = data.length;
    summaryParams['service'] = outcome?.serviceLabel ?? '-';
    summaryParams['detail'] = outcome?.detail ?? '';
  } else if (data.length > bodyStart) {
    // AInv / AMNI / adı olmayan tip: gövde bu motorun kapsamı DIŞINDA. İki
    // kaynak da bu iki tip için alan tablosu VERMİYOR (W yalnız tipi
    // adlandırıyor, gövdeyi `dissect_epl_payload`a bırakıyor). Ham basılır ve
    // NEDEN çözülmediği söylenir — "boş kart basmak yasak".
    messageClass = messageType === MSG_TYPE_AINV ? 'ainv' : messageType === MSG_TYPE_AMNI ? 'amni' : 'unknown';
    pushRawBlock(fields, data, {
      id: `payload-${bodyStart}`,
      name: 'POWERLINK Payload',
      offset: bodyStart,
      length: data.length - bodyStart,
      warnings: [WARN_BODY_NOT_DECODED],
    });
    warnings.push(WARN_BODY_NOT_DECODED);
    consumedEnd = data.length;
  }

  appendPadding(data, consumedEnd, fields, warnings);

  return buildResult(
    data,
    fields,
    warnings,
    errors,
    {
      messageType,
      messageClass,
      sourceNodeId,
      destinationNodeId,
      summaryKey,
      summaryParams,
    },
    options,
  );
}

export function parsePowerlink(data: Uint8Array): ParseResult {
  return parsePowerlinkFrame(data, {});
}

export const powerlinkParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme: asgari uzunluk + EtherType 0x88AB. VLAN'lı varyantta tip
   * alanı bir tag kadar (4 bayt) ileridedir; tek tag'e kadar bakılır, ötesi
   * tam çözüme bırakılır (`canParse` O(1) kalmalı, spec §7).
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_HEADER_LENGTH + BASIC_HEADER_LENGTH) return false;
    const first = (byteAt(data, MAC_LENGTH * 2) << 8) | byteAt(data, MAC_LENGTH * 2 + 1);
    if (first === POWERLINK_ETHER_TYPE) return true;
    if (first !== VLAN_TPID) return false;
    if (data.length < MIN_HEADER_LENGTH + VLAN_TAG_LENGTH + BASIC_HEADER_LENGTH) return false;
    const tagged =
      (byteAt(data, MAC_LENGTH * 2 + VLAN_TAG_LENGTH) << 8) |
      byteAt(data, MAC_LENGTH * 2 + VLAN_TAG_LENGTH + 1);
    return tagged === POWERLINK_ETHER_TYPE;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: PowerlinkParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parsePowerlinkFrame(data, options);
  },
};

// ── Örnek çerçeveler ────────────────────────────────────────────────────────
// Baytlar ELLE değil YAPIYA göre kurulur: uzunluk alanları bölge dizilerinden
// HESAPLANIR, böylece bir alan eklenince uzunluk güncellemeyi unutmak
// imkansızlaşır (`ethercat.ts`/`profinet.ts` emsali). Testler bu bütçeyi
// BAĞIMSIZ aritmetikle yeniden hesaplar ve iki kaynağın verdiği asgari
// boylarla (O `C_DLL_MINSIZE_*`) karşılaştırır.
//
// DEĞERLER SENTETİKtir (yakalanmış bir POWERLINK trafiği bu depoda yok) ama
// YAPI kaynaklardan doğrulanmıştır: her örneğin toplam boyu openPOWERLINK'in
// `C_DLL_MINSIZE_{SOC 36, PREQ 60, PRES 60, SOA 54, IDENTRES 176,
// STATUSRES 72}` sabitleriyle birebir tutar.

/** O `C_DLL_MULTICAST_{SOC,PRES,SOA,ASND}` — kanonik biçim. */
const MULTICAST_SOC = [0x01, 0x11, 0x1e, 0x00, 0x00, 0x01];
const MULTICAST_PRES = [0x01, 0x11, 0x1e, 0x00, 0x00, 0x02];
const MULTICAST_SOA = [0x01, 0x11, 0x1e, 0x00, 0x00, 0x03];
const MULTICAST_ASND = [0x01, 0x11, 0x1e, 0x00, 0x00, 0x04];
/** Örneklerdeki MN/CN MAC'leri sentetik ama yapısal (locally administered). */
const MN_MAC = [0x02, 0x00, 0x00, 0xf0, 0x00, 0x01];
const CN_MAC = [0x02, 0x00, 0x00, 0x01, 0x00, 0x01];

function uint16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function uint32(value: number): number[] {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

function ascii(text: string, length: number): number[] {
  const bytes = new Array<number>(length).fill(0x00);
  for (let index = 0; index < Math.min(text.length, length); index += 1) {
    bytes[index] = text.charCodeAt(index) & 0x7f;
  }
  return bytes;
}

function buildFrame(
  destination: readonly number[],
  source: readonly number[],
  messageType: number,
  destinationNodeId: number,
  sourceNodeId: number,
  body: readonly number[],
  padTo?: number,
): Uint8Array {
  const bytes = [
    ...destination,
    ...source,
    0x88,
    0xab,
    messageType,
    destinationNodeId,
    sourceNodeId,
    ...body,
  ];
  if (padTo !== undefined) while (bytes.length < padTo) bytes.push(0x00);
  return Uint8Array.from(bytes);
}

/** SoC gövdesi: rsvd + flags + rsvd + NetTime(8) + RelativeTime(8) = 19 bayt. */
function socBody(flags: number, seconds: number, nanoseconds: number, relative: number): number[] {
  return [
    0x00,
    flags,
    0x00,
    ...uint32(seconds),
    ...uint32(nanoseconds),
    ...uint32(relative),
    ...uint32(0),
  ];
}

/** PReq/PRes gövdesi: durum/rsvd + flags + flags2 + version + rsvd + Size(2) + yük. */
function pdoBody(
  first: number,
  flags: number,
  flags2: number,
  pdoVersion: number,
  payload: readonly number[],
): number[] {
  return [first, flags, flags2, pdoVersion, 0x00, ...uint16(payload.length), ...payload];
}

/** Spec özetindeki sürücü örneği: Control Word 0x000F + hedef hız 1500 rpm. */
const DRIVE_PAYLOAD = [...uint16(0x000f), ...uint16(0x05dc), ...new Array<number>(32).fill(0x00)];
/** CANopen'ın ≤8 baytlık PDO sınırının POWERLINK'te geçmediğini gösteren yük. */
const LARGE_PAYLOAD = [
  ...uint16(0x000f),
  ...uint16(0x05dc),
  ...new Array<number>(196).fill(0xa5),
];

function soaBody(serviceId: number, target: number, payload: readonly number[] = []): number[] {
  return [0xfd, 0x00, 0x00, serviceId, target, 0x20, 0x00, ...payload];
}

/** SyncRequest yükü: SyncControl + 5×UINT32 + hedef MAC = 30 bayt. */
const SYNC_REQUEST_PAYLOAD = [
  ...uint32(0x00000021),
  ...uint32(20_000),
  ...uint32(0),
  ...uint32(1_000),
  ...uint32(0),
  ...uint32(400_000),
  ...CN_MAC,
];

/** IdentResponse gövdesi (ServiceID'den SONRAsı) — toplam çerçeve 176 bayt. */
const IDENT_RESPONSE_BODY = [
  0x00, // flag1
  0x00, // flag2
  0xfd, // NMTStatus = NMT_CS_OPERATIONAL
  0x00, // IdentResponseFlags
  0x20, // POWERLINKVersion 2.0
  0x00, // reserved
  ...uint32(0x0000000e), // FeatureFlags
  ...uint16(300), // MTU
  ...uint16(36), // PollInSize
  ...uint16(36), // PollOutSize
  ...uint32(25_000), // ResponseTime (ns)
  ...uint16(0), // reserved
  ...uint32(0x00000192), // DeviceType (402 = drive profile)
  ...uint32(0x000000ab), // VendorId
  ...uint32(0x00010203), // ProductCode
  ...uint32(0x00000001), // RevisionNumber
  ...uint32(0x0000beef), // SerialNumber
  ...uint32(0), // VendorSpecificExt1 (8 bayt)
  ...uint32(0),
  ...uint32(0x0000162e), // VerifyConfigurationDate
  ...uint32(0x02faf080), // VerifyConfigurationTime
  ...uint32(0x0000162e), // ApplicationSwDate
  ...uint32(0x02faf080), // ApplicationSwTime
  ...uint32(0), // IPAddress (ham — iki kaynak bayt sırasında çakışıyor)
  ...uint32(0), // SubnetMask
  ...uint32(0), // DefaultGateway
  ...ascii('drive-cn-01', 32), // HostName
  ...new Array<number>(48).fill(0x00), // VendorSpecificExt2
];

/** Bir hata geçmişi girdisi (20 bayt). */
function errorEntry(entryType: number, errorCode: number, seconds: number): number[] {
  return [
    ...uint16(entryType),
    ...uint16(errorCode),
    ...uint32(seconds),
    ...uint32(0),
    ...uint32(0),
    ...uint32(0),
  ];
}

/** StatusResponse gövdesi — iki girdiyle toplam çerçeve 72 bayt (O sabitiyle aynı). */
const STATUS_RESPONSE_BODY = [
  0x10, // flag1: EN
  0x08, // flag2: PR = 1
  0xfd, // NMTStatus = NMT_CS_OPERATIONAL
  0x00,
  0x00,
  0x00, // reserved (3)
  ...uint32(0x00000021), // StaticErrorBitField (8 bayt)
  ...uint32(0),
  ...errorEntry(0x8002, 0x8235, 1_700_000_000), // Status entry, PLK profile, jitter
  ...errorEntry(0x1002, 0x8245, 1_700_000_001), // History entry, active, SoC loss
];

/** SDO Sequence Layer: ReceiveCon=Valid, SendCon=Valid, sıra numaraları. */
const SDO_SEQUENCE_VALID = [0x0a, 0x0e, 0x00, 0x00];

/** SDO Command Layer sabit başlığı (8 bayt) + gövde. */
function sdoCommand(
  transactionId: number,
  flags: number,
  commandId: number,
  body: readonly number[],
): number[] {
  return [0x00, transactionId, flags, commandId, ...uint16(body.length), 0x00, 0x00, ...body];
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'soc-cycle-start',
    name: 'protocol.powerlink.example.socCycleStart.name',
    bytes: buildFrame(
      MULTICAST_SOC,
      MN_MAC,
      MSG_TYPE_SOC,
      0xff,
      0xf0,
      socBody(0x00, 1_700_000_000, 250_000, 4_000_000),
      60,
    ),
    description: 'protocol.powerlink.example.socCycleStart.description',
    expectedValid: true,
  },
  {
    id: 'soc-multiplexed-prescaled',
    name: 'protocol.powerlink.example.socMultiplexedPrescaled.name',
    bytes: buildFrame(
      MULTICAST_SOC,
      MN_MAC,
      MSG_TYPE_SOC,
      0xff,
      0xf0,
      socBody(SOC_MC_MASK | SOC_PS_MASK, 1_700_000_000, 750_000, 4_001_000),
      60,
    ),
    description: 'protocol.powerlink.example.socMultiplexedPrescaled.description',
    expectedValid: true,
  },
  {
    id: 'preq-poll-request',
    name: 'protocol.powerlink.example.preqPollRequest.name',
    bytes: buildFrame(CN_MAC, MN_MAC, MSG_TYPE_PREQ, 0x01, 0xf0, pdoBody(0x00, PDO_RD_MASK, 0x00, 0x10, DRIVE_PAYLOAD)),
    description: 'protocol.powerlink.example.preqPollRequest.description',
    expectedValid: true,
  },
  {
    id: 'pres-poll-response',
    name: 'protocol.powerlink.example.presPollResponse.name',
    bytes: buildFrame(
      MULTICAST_PRES,
      CN_MAC,
      MSG_TYPE_PRES,
      0xff,
      0x01,
      pdoBody(0xfd, PDO_RD_MASK, 0x00, 0x10, DRIVE_PAYLOAD),
    ),
    description: 'protocol.powerlink.example.presPollResponse.description',
    expectedValid: true,
  },
  {
    id: 'pres-large-pdo',
    name: 'protocol.powerlink.example.presLargePdo.name',
    // CANopen'da bir PDO ≤ 8 bayttır ve uzunluk alanı YOKTUR; burada 200 bayt
    // yük ÇERÇEVEDEKİ 16-bit Size alanıyla bildiriliyor (paylaşım kararının
    // üçüncü kanıtı, dosya başı).
    bytes: buildFrame(
      MULTICAST_PRES,
      CN_MAC,
      MSG_TYPE_PRES,
      0xff,
      0x01,
      pdoBody(0xfd, PDO_RD_MASK | PDO_EN_MASK, PDO_PR_MASK, 0x10, LARGE_PAYLOAD),
    ),
    description: 'protocol.powerlink.example.presLargePdo.description',
    expectedValid: true,
  },
  {
    id: 'pres-size-exceeds-frame',
    name: 'protocol.powerlink.example.presSizeExceedsFrame.name',
    // Size 512 vaat ediyor, telde 36 bayt var → uyarı, kırpılmış yük.
    bytes: buildFrame(MULTICAST_PRES, CN_MAC, MSG_TYPE_PRES, 0xff, 0x01, [
      0xfd,
      PDO_RD_MASK,
      0x00,
      0x10,
      0x00,
      ...uint16(512),
      ...DRIVE_PAYLOAD,
    ]),
    description: 'protocol.powerlink.example.presSizeExceedsFrame.description',
    expectedValid: true,
  },
  {
    id: 'soa-ident-request',
    name: 'protocol.powerlink.example.soaIdentRequest.name',
    bytes: buildFrame(MULTICAST_SOA, MN_MAC, MSG_TYPE_SOA, 0xff, 0xf0, soaBody(0x01, 0x01), 60),
    description: 'protocol.powerlink.example.soaIdentRequest.description',
    expectedValid: true,
  },
  {
    id: 'soa-sync-request',
    name: 'protocol.powerlink.example.soaSyncRequest.name',
    bytes: buildFrame(
      MULTICAST_SOA,
      MN_MAC,
      MSG_TYPE_SOA,
      0xff,
      0xf0,
      soaBody(0x06, 0x01, SYNC_REQUEST_PAYLOAD),
      60,
    ),
    description: 'protocol.powerlink.example.soaSyncRequest.description',
    expectedValid: true,
  },
  {
    id: 'asnd-ident-response',
    name: 'protocol.powerlink.example.asndIdentResponse.name',
    bytes: buildFrame(MULTICAST_ASND, CN_MAC, MSG_TYPE_ASND, 0xf0, 0x01, [
      0x01,
      ...IDENT_RESPONSE_BODY,
    ]),
    description: 'protocol.powerlink.example.asndIdentResponse.description',
    expectedValid: true,
  },
  {
    id: 'asnd-status-response',
    name: 'protocol.powerlink.example.asndStatusResponse.name',
    bytes: buildFrame(MULTICAST_ASND, CN_MAC, MSG_TYPE_ASND, 0xf0, 0x01, [
      0x02,
      ...STATUS_RESPONSE_BODY,
    ]),
    description: 'protocol.powerlink.example.asndStatusResponse.description',
    expectedValid: true,
  },
  {
    id: 'asnd-nmt-start-node',
    name: 'protocol.powerlink.example.asndNmtStartNode.name',
    bytes: buildFrame(
      MULTICAST_ASND,
      MN_MAC,
      MSG_TYPE_ASND,
      0xff,
      0xf0,
      [0x04, 0x21, 0x00, ...new Array<number>(32).fill(0x00)],
      60,
    ),
    description: 'protocol.powerlink.example.asndNmtStartNode.description',
    expectedValid: true,
  },
  {
    id: 'asnd-sdo-read-by-index',
    name: 'protocol.powerlink.example.asndSdoReadByIndex.name',
    // ReadByIndex isteği, expedited: Index 0x1006 (NMT_CycleLen_U32), Sub 0x00.
    bytes: buildFrame(
      CN_MAC,
      MN_MAC,
      MSG_TYPE_ASND,
      0x01,
      0xf0,
      [0x05, ...SDO_SEQUENCE_VALID, ...sdoCommand(0x07, 0x00, 0x02, [...uint16(0x1006), 0x00, 0x00])],
      60,
    ),
    description: 'protocol.powerlink.example.asndSdoReadByIndex.description',
    expectedValid: true,
  },
  {
    id: 'asnd-sdo-abort',
    name: 'protocol.powerlink.example.asndSdoAbort.name',
    // Abort biti (0x40) + Response biti (0x80): 0x06020000 = "obje yok".
    bytes: buildFrame(
      MULTICAST_ASND,
      CN_MAC,
      MSG_TYPE_ASND,
      0xf0,
      0x01,
      [0x05, ...SDO_SEQUENCE_VALID, ...sdoCommand(0x07, 0xc0, 0x02, uint32(0x06020000))],
      60,
    ),
    description: 'protocol.powerlink.example.asndSdoAbort.description',
    expectedValid: true,
  },
  {
    id: 'ainv-async-invite',
    name: 'protocol.powerlink.example.ainvAsyncInvite.name',
    // AInv'in gövdesi için iki kaynakta da alan tablosu YOK → ham + uyarı.
    bytes: buildFrame(MULTICAST_SOA, MN_MAC, MSG_TYPE_AINV, 0x02, 0xf0, [0x00, 0x00, 0x01], 60),
    description: 'protocol.powerlink.example.ainvAsyncInvite.description',
    expectedValid: true,
  },
  {
    id: 'ethertype-not-powerlink',
    name: 'protocol.powerlink.example.etherTypeNotPowerlink.name',
    // SoC örneğinin aynısı, EtherType kasten 0x0800 (IPv4).
    bytes: Uint8Array.from([
      ...MULTICAST_SOC,
      ...MN_MAC,
      0x08,
      0x00,
      MSG_TYPE_SOC,
      0xff,
      0xf0,
      ...socBody(0x00, 1_700_000_000, 250_000, 4_000_000),
    ]),
    description: 'protocol.powerlink.example.etherTypeNotPowerlink.description',
    expectedValid: false,
  },
  {
    id: 'frame-too-short',
    name: 'protocol.powerlink.example.frameTooShort.name',
    // 12 bayt: Ethernet başlığı bile tamamlanmıyor → ParseFailure.
    bytes: Uint8Array.from([...MULTICAST_SOC, ...MN_MAC]),
    description: 'protocol.powerlink.example.frameTooShort.description',
    expectedValid: false,
  },
];

export const powerlinkPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: powerlinkParser,
  documentation: {
    summary: 'protocol.powerlink.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'Wireshark EPL dissector (packet-epl.c) — field layout reference',
        url: 'https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-epl.c',
      },
      {
        title: 'openPOWERLINK V2 — frame.h / nmt.h / oplkdefs.h (documented constants only)',
        url: 'https://github.com/OpenAutomationTechnologies/openPOWERLINK_V2',
      },
      {
        title: 'IEEE EtherType registry — 0x88AB, B&R Industrial Automation, ETHERNET Powerlink',
        url: 'https://standards-oui.ieee.org/ethertype/eth.txt',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
