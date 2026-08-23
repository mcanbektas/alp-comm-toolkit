/**
 * Sercos III (Sercos International / IEC 61158 & 61784-2 CPF 16) — kontrol,
 * sürücü ve I/O için Fast Ethernet üstünde gerçek zamanlı hareket veri yolu.
 * Girdi TAM BİR ETHERNET ÇERÇEVESİdir: DST MAC + SRC MAC (+ opsiyonel VLAN
 * tag'leri) + EtherType 0x88CD + 6 baytlık Sercos başlığı + haberleşme fazına
 * (CP0-CP4) göre değişen gövde (+ Ethernet dolgusu).
 *
 * Faz 10, dalga 13f. `industrial-ethernet` ailesinin dördüncü `ready` kaydı;
 * bu kayıtla aile KAPANIR.
 *
 * ── GİRDİ MODELİ — AİLE İÇİ TUTARLILIK ──────────────────────────────────────
 * `ethercat.ts` (5d), `profinet.ts` (13e) ve `powerlink.ts` (13f) TAM Ethernet
 * çerçevesi alır ve `network/ethernet/ethernetFrame.ts`in dışa açılan
 * yardımcılarını PAYLAŞIR. Sercos III de AYNI ÇİZGİDE: EtherType 0x88CD
 * doğrudan bu çerçeveyi işaret eder, IP/UDP kapsüllemesi yoktur. İkinci bir MAC
 * biçimleyici ya da ikinci bir VLAN yürüyüşü YAZILMADI; 0x88CD
 * `ETHER_TYPE_NAMES`e de eklendi.
 *
 * ── KAYNAK UYARISI ──────────────────────────────────────────────────────────
 * Sercos International'ın spec metni bu depoda YOKTUR. Alan yerleşimleri İKİ
 * bağımsız, kamuya açık kaynaktan ÇAPRAZ TEYİTLE alındı (ikisine de bu oturumda
 * gerçekten erişildi; KOD KOPYALANMADI):
 *   W = **Wireshark Sercos III dissector'ı** `epan/dissectors/packet-sercosiii.c`
 *       (GPL-2.0-or-later). Dosyanın kendi telif satırı katkıyı
 *       "Bosch Rexroth / Hilscher" olarak veriyor — protokolü tanımlayan
 *       firmaların yayımladığı alan tanımı (EtherCAT'te Beckhoff imzalı
 *       dissector'ın aynı durumu).
 *       https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-sercosiii.c
 *   S = **Sercos Soft Master Core Library (SICE + CoSeMa)**, MIT lisanslı,
 *       `aschiffler/linuxcnc-sercos3` deposunda: `src/SICE/SICE_PRIV.h`
 *       (`SICE_SIII_FRAME` birleşimi ve `SICE_TEL_*` maskeleri),
 *       `src/CSMD/CSMD_GLOB.h` (`CSMD_C_DEV_*` / `CSMD_S_DEV_*` cihaz
 *       kontrol/durum bitleri). Bir DISSECTOR değil, bir UYGULAMA — çerçeveyi
 *       KURAN taraf; çapraz teyit için doğru ikinci kaynak.
 *       https://github.com/aschiffler/linuxcnc-sercos3
 * ÜÇÜNCÜ, BAĞIMSIZ TEYİT: **IEEE EtherType kayıt defteri** 0x88CD'yi
 * "sercos international e.V. — SERCOS interface" olarak listeler.
 * https://standards-oui.ieee.org/ethertype/eth.txt
 *
 * Başlığın 6 baytlık boyu iki kaynakta BİREBİR: W `dissect_siii_mst()` alanları
 * 0..5'e yerleştirir; S'nin `SICE_SIII_FRAME.rTel` yapısı
 * `MAC(6)+MAC(6)+usPortID(2)+ucSercosType(1)+ucPhase(1)+ulCRC(4)` = 20 bayt
 * başlık verir (`SICE_SERC3_TEL_HEADER 20`), yani Ethernet'ten sonra tam 6 bayt.
 *
 * ── İKİ KAYNAĞIN ÇAKIŞTIĞI YER: TELGRAF NUMARASI BİT GENİŞLİĞİ ─────────────
 * W telgraf numarasını `type & 0x0F` ile okur ama KENDİ YORUMU
 * "even though it's reserved (the V1.1 spec states that it is reserved for
 * additional MDT/AT)" der. S ise `SICE_TEL_NO_MASK (0x03)` — yalnız iki bit.
 * Kaynaklar bit 0-1'de ANLAŞIYOR, bit 2-3'te ANLAŞMIYOR. Bu yüzden telgraf
 * numarası bit 0-1'den okunur; bit 2-3 AYRI bir alan olarak basılır ve
 * `WARN_TELEGRAM_NUMBER_WIDTH_CONFLICT` taşır. Yanlış genişlikte okunmuş bir
 * telgraf numarası, CP1/CP2'de yanlış cihaz grubuna işaret ederdi.
 *
 * ── CRC32 GÖSTERİLİR, DOĞRULANMAZ — GEREKÇE ─────────────────────────────────
 * Başlıktaki 4 baytlık CRC32'nin ALGORİTMA PARAMETRELERİ tek kaynaklıdır:
 * S `SICE_PRIV.h` üretici polinomu `0xEDB88320` ve CRC'ye giren başlık boyunu
 * `SICE_TEL_LENGTH_HDR_FOR_CRC (0x10)` = 16 bayt (14 Ethernet + 2 Sercos)
 * olarak verir, ama başlangıç değeri / son XOR ikinci bir kaynakta teyitli
 * DEĞİL. W ise CRC32'yi yalnız GÖSTERİR, hesaplamaz. Dolayısıyla bu motor da
 * alanı adlandırıp basar ama **MISMATCH ASLA BASMAZ** — `ethercat.ts`in
 * Working Counter kararının aynısı. Yanlış parametreyle hesaplanmış bir
 * "CRC hatalı" rozeti, hiç doğrulamamaktan çok daha kötüdür.
 *
 * ── CP3/CP4 GÖVDESİ HAM BIRAKILIR — SAHTE ALAN KIRILIMI YOK ────────────────
 * Operasyonel fazlarda (CP3/CP4) servis kanalı, cihaz durumu ve bağlantı
 * (connection) ofsetleri ÇERÇEVEDE YAZMAZ: CP2 sırasında servis kanalı
 * üzerinden pazarlanan konfigürasyondan gelir. Bu, bir kapsam kısıtı değil
 * protokolün doğasıdır ve REFERANS DISSECTOR DA AYNI YERDE DURUR — W'nin
 * `dissect_siii_{mdt,at}_cp3_4()` fonksiyonunun kendi yorumu:
 * *"offsets of service channel, device status and connections are unknown /
 * this data could be extracted from svc communication during CP2"*.
 * Bu motor da bölgeyi TEK PARÇA ham basar ve nedenini
 * `WARN_CP34_LAYOUT_FROM_CP2` ile söyler (uydurma yasağı; `profinet.ts`in
 * GSDML'siz I/O verisi ve `ethercat.ts`in datagram verisi emsali).
 *
 * ── STATUS: 'ready' — GEREKÇE (`ethercat.ts` ölçütü) ────────────────────────
 * Sercos başlığının HER alanı adlandırılıp çözülür: kanal (P/S), telgraf tipi
 * (MDT/AT), cycle count valid biti, telgraf numarası, haberleşme fazı, faz
 * geçiş biti, cycle sayacı, CRC32. Faz-bağımlı gövdelerin YAPISI sabit olan
 * her yerinde (CP0'ın sürüm alanı ve tanınan cihaz listesi, CP1/CP2'nin
 * cihaz-indeksli servis kanalı ve C-DEV/S-DEV kelimeleri, CP3/CP4'ün hot-plug
 * alanı) alanlar çözülür. Ham kalan tek bölge CP3/CP4'ün konfigürasyona bağlı
 * gövdesidir ve bu YAPISAL bir eksik değil TANIM-BAĞIMLI içeriktir —
 * `ethercat.ts`in datagram verisiyle aynı sınıf. Protokolün kendi tanımladığı
 * doğrulama (CRC32) atlanmıyor; kaynak yetersizliği nedeniyle bilinçli olarak
 * YAPILMIYOR ve bu kullanıcıya söyleniyor (yukarı).
 *
 * ── decodeOptions: AÇILMADI, GEREKÇESİ ──────────────────────────────────────
 *  1. "Haberleşme fazı" → ÇERÇEVEDE YAZAR (faz alanı, bayt 1). Kanal gereksiz
 *     olurdu (dalga 12f'nin WebSocket MASK-biti dersi).
 *  2. "MDT mi AT mi" → telgraf tipi bitinden çıkar.
 *  3. "CP3/CP4 bağlantı ofsetleri" → bir `select`/`number` alanına SIĞMAZ;
 *     CP2'de pazarlanmış tam bir bağlantı konfigürasyonu (telgraf no + tip +
 *     ofset + uzunluk, bağlantı başına) ister. Yarım bir kanal yanlış kırılıma
 *     davet olurdu (`profinet.ts`in IOPS/IOCS gerekçesinin aynısı).
 *
 * ── KAPSAM DIŞI (dosya başında AÇIKÇA) ──────────────────────────────────────
 *  • **UCC (Unified Communication Channel)**: Sercos döngüsünün NRT
 *    penceresinde taşınan standart Ethernet/IP trafiği. 0x88CD ALTINDA GELMEZ,
 *    kendi EtherType'ıyla gelir — bu motorun girdisi değildir.
 *  • **Sercos I/II** (optik halka) ve **SIP (Sercos Internet Protocol, TCP)**:
 *    ayrı tel biçimleri, ayrı kayıtlar.
 *  • **IDN sözlüğü** (S-0-xxxx / P-0-xxxx parametre adları): servis kanalı
 *    IDN'i sayısal olarak çözülür ama adı verilmez — sözlük cihaz tanımından
 *    gelir, çerçeveden değil.
 *  • **Çok çerçeveli analiz**: cycle timing/jitter, faz zaman çizelgesi,
 *    topoloji ağacı, servis kanalı oturumunun yeniden birleştirilmesi —
 *    `ethercat.ts`in "analyzer sınırı" emsali.
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

/** Katalogdaki kayıt id'siyle birebir aynı olmalı — plugin bağı budur. */
const PROTOCOL_ID = 'sercos-iii';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Sercos III';

/** W `ETHERTYPE_SERCOS`, S `usPortID`, IEEE kayıt defteri. */
const SERCOS_ETHER_TYPE = 0x88cd;

/** Telgraf tipi(1) + faz(1) + CRC32(4) — iki kaynakta birebir. */
const SERCOS_HEADER_LENGTH = 6;
const CRC32_LENGTH = 4;
const HEX_RADIX = 16;
/** VLAN'lı varyantta tip alanı bir tag kadar ilerideki ofsettedir. */
const VLAN_TAG_LENGTH = 4;

/** Bayt 0 maskeleri — W hf tablosu ve S `SICE_TEL_*` birebir aynı. */
const CHANNEL_MASK = 0x80;
const TELEGRAM_TYPE_MASK = 0x40;
const CYCLE_COUNT_VALID_MASK = 0x20;
/** İki kaynağın ANLAŞTIĞI genişlik (S `SICE_TEL_NO_MASK`). */
const TELEGRAM_NUMBER_MASK = 0x03;
/** W bunları da numaraya katıyor, S katmıyor → ayrı alan + uyarı. */
const TELEGRAM_NUMBER_EXTENDED_MASK = 0x0c;

/** Bayt 1 maskeleri (W hf tablosu; S `SICE_TEL_CP_MASK`/`CP_SWITCH_MASK`). */
const PHASE_MASK = 0x0f;
const PHASE_SWITCH_MASK = 0x80;
/** Yalnız W'de adlandırılmış (S'nin faz baytında sayaç yok) → uyarı taşır. */
const CYCLE_COUNT_MASK = 0x70;
const CYCLE_COUNT_SHIFT = 4;

/**
 * CP1/CP2'de her telgraf 128 cihazın verisini taşır (W
 * `SERCOS_SLAVE_GROUP_SIZE 128`). Servis kanalı girdisi 6 bayt; cihaz
 * kontrol/durum girdisi 4 bayt (S `CSMD_C_DEV_LENGTH_CP1_2 4` yorumu:
 * "2 Byte + 2 Byte reserved").
 */
const SLAVE_GROUP_SIZE = 128;
const SVC_ENTRY_LENGTH = 6;
const DEVICE_ENTRY_LENGTH = 4;
const SVC_REGION_LENGTH = SLAVE_GROUP_SIZE * SVC_ENTRY_LENGTH;
const DEVICE_REGION_LENGTH = SLAVE_GROUP_SIZE * DEVICE_ENTRY_LENGTH;

/**
 * Cihaz başına ayrıntılı çözümde ÜST SINIR. Tam boy bir CP1/CP2 telgrafı 128
 * cihaz taşır ve her biri üç alan üretse tablo 384 satıra çıkardı; ötesi
 * TEK PARÇA ham basılır ve uyarı verilir. Aynı desen `ethernetFrame.ts`in
 * `MAX_VLAN_TAGS` sınırında da var: sınır aşılınca sessizce kesilmez, söylenir.
 */
const MAX_DETAILED_DEVICES = 16;

/** CP0/AT0 tanınan cihaz listesi: her giriş 2 bayt, adres alanı 9 bit. */
const MAX_SERCOS_ADDRESS = 0x01ff;
/** Hot-Plug alanı: Sercos adresi(2) + kontrol/durum(2) + bilgi(4). */
const HOT_PLUG_LENGTH = 8;

export const ERROR_FRAME_TOO_SHORT = 'protocol.sercosIii.error.frameTooShort';
export const ERROR_FRAME_TOO_LONG = 'protocol.sercosIii.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.sercosIii.error.aborted';
export const ERROR_ETHER_TYPE_NOT_SERCOS = 'protocol.sercosIii.error.etherTypeNotSercos';
export const ERROR_HEADER_TRUNCATED = 'protocol.sercosIii.error.headerTruncated';

export const WARN_CRC32_NOT_VERIFIED = 'protocol.sercosIii.warning.crc32NotVerified';
export const WARN_TELEGRAM_NUMBER_WIDTH_CONFLICT =
  'protocol.sercosIii.warning.telegramNumberWidthConflict';
export const WARN_CYCLE_COUNT_SINGLE_SOURCE = 'protocol.sercosIii.warning.cycleCountSingleSource';
export const WARN_CYCLE_COUNT_INVALID = 'protocol.sercosIii.warning.cycleCountInvalid';
export const WARN_PHASE_NOT_NAMED = 'protocol.sercosIii.warning.phaseNotNamed';
export const WARN_CP34_LAYOUT_FROM_CP2 = 'protocol.sercosIii.warning.cp34LayoutFromCp2';
export const WARN_DEVICE_LIST_TRUNCATED = 'protocol.sercosIii.warning.deviceListTruncated';
export const WARN_DETAILED_DEVICE_LIMIT = 'protocol.sercosIii.warning.detailedDeviceLimit';
export const WARN_SVC_INFO_NEEDS_IDN_DICTIONARY =
  'protocol.sercosIii.warning.svcInfoNeedsIdnDictionary';
export const WARN_VERSION_FIELD_BITS_SINGLE_SOURCE =
  'protocol.sercosIii.warning.versionFieldBitsSingleSource';
export const WARN_HOT_PLUG_BITS_SINGLE_SOURCE = 'protocol.sercosIii.warning.hotPlugBitsSingleSource';
export const WARN_RECOGNIZED_DEVICE_LIST_RAW = 'protocol.sercosIii.warning.recognizedDeviceListRaw';
export const WARN_PADDING_NOT_ZERO = 'protocol.sercosIii.warning.paddingNotZero';

const SUMMARY_MDT = 'protocol.sercosIii.summary.mdt';
const SUMMARY_AT = 'protocol.sercosIii.summary.at';
const SUMMARY_NOT_SERCOS = 'protocol.sercosIii.summary.notSercos';

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** Sercos başlığından itibaren HER ŞEY LITTLE-ENDIAN'dır (iki kaynak da böyle). */
function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

function readUint32Le(data: Uint8Array, offset: number): number {
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

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

class WarningSink {
  private readonly seen = new Set<string>();
  readonly warnings: ProtocolWarning[] = [];
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

export type SercosIiiFrameMetadata = {
  /** EtherType yanlışsa `undefined`. */
  telegramType: 'mdt' | 'at' | undefined;
  phase: number | undefined;
  telegramNumber: number | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface SercosIiiParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function pushRawBlock(
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

function pushBitField(
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
): boolean {
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
  return set;
}

/**
 * Bildirilen bölgeden sonra kalan baytlar Ethernet dolgusudur; sıfırdan
 * farklıysa uyarı (`ethercat.ts`/`profinet.ts` emsali).
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

interface HeaderOutcome {
  readonly isAt: boolean;
  readonly telegramNumber: number;
  readonly phase: number;
  readonly phaseSwitching: boolean;
  readonly bodyStart: number;
}

/** Sercos başlığı (6 bayt): telgraf tipi + faz + CRC32. */
function decodeSercosHeader(
  data: Uint8Array,
  start: number,
  fields: ParsedField[],
  warnings: WarningSink,
): HeaderOutcome {
  const typeByte = byteAt(data, start);

  pushBitField(fields, data, {
    id: `telegram-channel-${start}`,
    name: 'Telegram Type — Channel (bit 7)',
    offset: start,
    value: typeByte,
    mask: CHANNEL_MASK,
    onLabel: 'S-Telegram (secondary port)',
    offLabel: 'P-Telegram (primary port)',
  });

  const isAt = pushBitField(fields, data, {
    id: `telegram-kind-${start}`,
    name: 'Telegram Type — MDT/AT (bit 6)',
    offset: start,
    value: typeByte,
    mask: TELEGRAM_TYPE_MASK,
    onLabel: 'AT (device telegram)',
    offLabel: 'MDT (master data telegram)',
  });

  pushBitField(fields, data, {
    id: `cycle-count-valid-${start}`,
    name: 'Telegram Type — Cycle Count Valid (bit 5)',
    offset: start,
    value: typeByte,
    mask: CYCLE_COUNT_VALID_MASK,
    onLabel: 'Valid',
    offLabel: 'Invalid',
  });

  const telegramNumber = typeByte & TELEGRAM_NUMBER_MASK;
  fields.push({
    id: `telegram-number-${start}`,
    name: 'Telegram Type — Telegram Number (bits 0-1)',
    offset: start,
    length: 1,
    rawBytes: data.slice(start, start + 1),
    rawValue: telegramNumber,
    valid: true,
    warnings: [],
  });

  // İki kaynak bit 2-3'te ANLAŞMIYOR (dosya başı) → ayrı alan + uyarı.
  const extended = (typeByte & TELEGRAM_NUMBER_EXTENDED_MASK) >>> 2;
  fields.push({
    id: `telegram-number-extended-${start}`,
    name: 'Telegram Type — Reserved for additional MDT/AT (bits 2-3)',
    offset: start,
    length: 1,
    rawBytes: data.slice(start, start + 1),
    rawValue: extended,
    valid: true,
    warnings: [WARN_TELEGRAM_NUMBER_WIDTH_CONFLICT],
  });
  warnings.push(WARN_TELEGRAM_NUMBER_WIDTH_CONFLICT);

  const phaseOffset = start + 1;
  const phaseByte = byteAt(data, phaseOffset);
  const phase = phaseByte & PHASE_MASK;
  const phaseKnown = phase <= 4;
  const phaseField: ParsedField = {
    id: `communication-phase-${phaseOffset}`,
    name: 'Phase Field — Communication Phase (bits 0-3)',
    offset: phaseOffset,
    length: 1,
    rawBytes: data.slice(phaseOffset, phaseOffset + 1),
    rawValue: phase,
    physicalValue: phaseKnown ? `CP${phase}` : formatHex(phase, 2),
    valid: phaseKnown,
    warnings: [],
  };
  if (!phaseKnown) {
    phaseField.warnings.push(WARN_PHASE_NOT_NAMED);
    warnings.push(WARN_PHASE_NOT_NAMED);
  }
  fields.push(phaseField);

  const phaseSwitching = pushBitField(fields, data, {
    id: `phase-switching-${phaseOffset}`,
    name: 'Phase Field — Phase Change in progress (bit 7)',
    offset: phaseOffset,
    value: phaseByte,
    mask: PHASE_SWITCH_MASK,
    onLabel: 'Switching',
    offLabel: 'Steady',
  });

  // Bit 4-6 yalnız W'de adlandırılıyor → alan basılır, tek kaynak uyarısıyla.
  const cycleCountValid = (typeByte & CYCLE_COUNT_VALID_MASK) !== 0;
  const cycleCountWarnings = [WARN_CYCLE_COUNT_SINGLE_SOURCE];
  if (!cycleCountValid) {
    // Cycle Count Valid biti sıfırken sayaç anlamsızdır — değeri basarız ama
    // "bu sayı geçerli değil" notunu da basarız.
    cycleCountWarnings.push(WARN_CYCLE_COUNT_INVALID);
    warnings.push(WARN_CYCLE_COUNT_INVALID);
  }
  fields.push({
    id: `cycle-count-${phaseOffset}`,
    name: 'Phase Field — Cycle Count (bits 4-6)',
    offset: phaseOffset,
    length: 1,
    rawBytes: data.slice(phaseOffset, phaseOffset + 1),
    rawValue: (phaseByte & CYCLE_COUNT_MASK) >>> CYCLE_COUNT_SHIFT,
    valid: true,
    warnings: cycleCountWarnings,
  });
  warnings.push(WARN_CYCLE_COUNT_SINGLE_SOURCE);

  const crcOffset = start + 2;
  const crc = readUint32Le(data, crcOffset);
  // DOĞRULANMAZ (dosya başı): algoritma parametreleri tek kaynaklı.
  fields.push({
    id: `header-crc32-${crcOffset}`,
    name: 'Sercos Header — CRC32',
    offset: crcOffset,
    length: CRC32_LENGTH,
    rawBytes: data.slice(crcOffset, crcOffset + CRC32_LENGTH),
    rawValue: crc,
    physicalValue: formatHex(crc, 8),
    valid: true,
    warnings: [WARN_CRC32_NOT_VERIFIED],
  });
  warnings.push(WARN_CRC32_NOT_VERIFIED);

  return {
    isAt,
    telegramNumber,
    phase,
    phaseSwitching,
    bodyStart: start + SERCOS_HEADER_LENGTH,
  };
}

/**
 * CP0 gövdesi. MDT0 4 baytlık "Communication Version" taşır; AT0 tanınan cihaz
 * listesini (sıra sayacı + Sercos adresleri) taşır. Bit adları (fast CP switch,
 * init procedure version …) yalnız W'de olduğu için sürüm alanı BİT BİT
 * kırılmaz: değeri hex basılır ve tek kaynak uyarısı taşır.
 */
function decodeCp0Body(
  data: Uint8Array,
  bodyStart: number,
  isAt: boolean,
  fields: ParsedField[],
  warnings: WarningSink,
): number {
  if (!isAt) {
    if (data.length - bodyStart < 4) return bodyStart;
    const version = readUint32Le(data, bodyStart);
    fields.push({
      id: `cp0-communication-version-${bodyStart}`,
      name: 'CP0 — Communication Version',
      offset: bodyStart,
      length: 4,
      rawBytes: data.slice(bodyStart, bodyStart + 4),
      rawValue: version,
      physicalValue: formatHex(version, 8),
      valid: true,
      warnings: [WARN_VERSION_FIELD_BITS_SINGLE_SOURCE],
    });
    warnings.push(WARN_VERSION_FIELD_BITS_SINGLE_SOURCE);
    return bodyStart + 4;
  }

  if (data.length - bodyStart < 2) return bodyStart;
  const sequenceCounter = readUint16Le(data, bodyStart);
  const recognized = (sequenceCounter & MAX_SERCOS_ADDRESS) - 1;
  fields.push({
    id: `cp0-sequence-counter-${bodyStart}`,
    name: 'CP0 — Sequence Counter',
    offset: bodyStart,
    length: 2,
    rawBytes: data.slice(bodyStart, bodyStart + 2),
    rawValue: sequenceCounter,
    // W: tanınan cihaz sayısı = (adres maskesi & sayaç) - 1.
    physicalValue: `${Math.max(0, recognized)} recognized device(s)`,
    valid: true,
    warnings: [],
  });

  // Adres listesi 511 girdilik sabit bir dizidir; her girdi 2 bayt. Tek tek
  // basmak tabloyu 511 satıra çıkarırdı — bölge ham basılır ve YAPISI söylenir.
  const listStart = bodyStart + 2;
  const listLength = Math.max(0, data.length - listStart);
  pushRawBlock(fields, data, {
    id: `cp0-recognized-device-list-${listStart}`,
    name: 'CP0 — Recognized Device List (2 B per Sercos address)',
    offset: listStart,
    length: listLength,
    warnings: [WARN_RECOGNIZED_DEVICE_LIST_RAW],
  });
  if (listLength > 0) warnings.push(WARN_RECOGNIZED_DEVICE_LIST_RAW);
  return listStart + listLength;
}

/**
 * CP1/CP2 gövdesi: 128 cihazlık servis kanalı bölgesi (6 B/cihaz) + 128
 * cihazlık kontrol/durum bölgesi (4 B/cihaz, 2 B kelime + 2 B ayrılmış).
 * Telgraf numarası cihaz grubunu kaydırır (MDT0 → 0-127, MDT1 → 128-255 …).
 */
function decodeCp12Body(
  data: Uint8Array,
  bodyStart: number,
  isAt: boolean,
  telegramNumber: number,
  fields: ParsedField[],
  warnings: WarningSink,
): number {
  const deviceBase = telegramNumber * SLAVE_GROUP_SIZE;
  const svcAvailable = Math.max(0, Math.min(SVC_REGION_LENGTH, data.length - bodyStart));
  const svcCount = Math.floor(svcAvailable / SVC_ENTRY_LENGTH);
  const detailedSvc = Math.min(svcCount, MAX_DETAILED_DEVICES);

  for (let index = 0; index < detailedSvc; index += 1) {
    decodeServiceChannelEntry(
      data,
      bodyStart + index * SVC_ENTRY_LENGTH,
      deviceBase + index,
      isAt,
      fields,
      warnings,
    );
  }
  if (svcCount > detailedSvc) {
    pushRawBlock(fields, data, {
      id: `svc-region-remainder-${bodyStart + detailedSvc * SVC_ENTRY_LENGTH}`,
      name: `Service Channel — devices ${deviceBase + detailedSvc}+ (6 B each)`,
      offset: bodyStart + detailedSvc * SVC_ENTRY_LENGTH,
      length: svcAvailable - detailedSvc * SVC_ENTRY_LENGTH,
      warnings: [WARN_DETAILED_DEVICE_LIMIT],
    });
    warnings.push(WARN_DETAILED_DEVICE_LIMIT);
  }

  const deviceStart = bodyStart + SVC_REGION_LENGTH;
  if (deviceStart >= data.length) {
    // Bölge telde YOK: CP1/CP2 telgrafı tam boy değil.
    warnings.push(WARN_DEVICE_LIST_TRUNCATED);
    return Math.min(data.length, bodyStart + svcAvailable);
  }

  const deviceAvailable = Math.max(
    0,
    Math.min(DEVICE_REGION_LENGTH, data.length - deviceStart),
  );
  const deviceCount = Math.floor(deviceAvailable / DEVICE_ENTRY_LENGTH);
  const detailedDevices = Math.min(deviceCount, MAX_DETAILED_DEVICES);
  for (let index = 0; index < detailedDevices; index += 1) {
    decodeDeviceWord(
      data,
      deviceStart + index * DEVICE_ENTRY_LENGTH,
      deviceBase + index,
      isAt,
      fields,
    );
  }
  if (deviceCount > detailedDevices) {
    pushRawBlock(fields, data, {
      id: `device-region-remainder-${deviceStart + detailedDevices * DEVICE_ENTRY_LENGTH}`,
      name: `${isAt ? 'Device Status' : 'Device Control'} — devices ${
        deviceBase + detailedDevices
      }+ (4 B each)`,
      offset: deviceStart + detailedDevices * DEVICE_ENTRY_LENGTH,
      length: deviceAvailable - detailedDevices * DEVICE_ENTRY_LENGTH,
      warnings: [WARN_DETAILED_DEVICE_LIMIT],
    });
    warnings.push(WARN_DETAILED_DEVICE_LIMIT);
  }
  if (deviceCount < SLAVE_GROUP_SIZE) warnings.push(WARN_DEVICE_LIST_TRUNCATED);

  return deviceStart + deviceAvailable;
}

/**
 * Servis kanalı girdisi (6 bayt): kontrol/durum kelimesi (2, LE) + bilgi (4).
 * MDT tarafında kontrol kelimesi MHS/RW/EOT/DBE bitlerini, AT tarafında durum
 * kelimesi AHS/Busy/Error/Valid bitlerini taşır. Bit KONUMLARI yalnız W'de,
 * ama DBE numaralandırması (0 Close … 7 Operation data) S'nin
 * `CSMD_SVC_DBE*` sabitleriyle birebir aynı — bu yüzden DBE değeri
 * ADLANDIRILIR, kelimenin bitleri ise tek kaynak uyarısı taşımadan
 * kırılmaz: kelime tek alan olarak basılır ve okunabilir özet verilir.
 */
function decodeServiceChannelEntry(
  data: Uint8Array,
  offset: number,
  deviceIndex: number,
  isAt: boolean,
  fields: ParsedField[],
  warnings: WarningSink,
): void {
  const word = readUint16Le(data, offset);
  const summary = isAt ? describeSvcStatus(word) : describeSvcControl(word);
  fields.push({
    id: `svc-${deviceIndex}-word-${offset}`,
    name: `Device ${deviceIndex} — ${isAt ? 'SvcStat' : 'SvcCtrl'}`,
    offset,
    length: 2,
    rawBytes: data.slice(offset, offset + 2),
    rawValue: word,
    physicalValue: summary,
    valid: true,
    warnings: [],
  });

  // Bilgi alanının ANLAMI DBE'ye bağlıdır (IDN, ad, öznitelik, birim, min,
  // max, işletim verisi). IDN'in SAYISAL değeri okunabilir ama parametre ADI
  // cihaz tanımından gelir — sözlük bu motorun kapsamı dışında.
  const infoOffset = offset + 2;
  const info = readUint32Le(data, infoOffset);
  fields.push({
    id: `svc-${deviceIndex}-info-${infoOffset}`,
    name: `Device ${deviceIndex} — Svc Info`,
    offset: infoOffset,
    length: 4,
    rawBytes: data.slice(infoOffset, infoOffset + 4),
    rawValue: info,
    physicalValue: formatHex(info, 8),
    valid: true,
    warnings: [WARN_SVC_INFO_NEEDS_IDN_DICTIONARY],
  });
  warnings.push(WARN_SVC_INFO_NEEDS_IDN_DICTIONARY);
}

/** S `CSMD_SVC_DBE0..7` ile birebir; W'nin 0x0038 maskesi aynı üç biti seçer. */
const DATA_BLOCK_ELEMENT_LABELS: readonly string[] = [
  'Close service channel',
  'IDN',
  'Name',
  'Attribute',
  'Unit',
  'Minimum value',
  'Maximum value',
  'Operation data',
];

function describeSvcControl(word: number): string {
  const dbe = (word >>> 3) & 0x07;
  const parts = [
    `MHS=${word & 0x01}`,
    (word & 0x02) === 0 ? 'Read' : 'Write',
    `EOT=${(word >>> 2) & 0x01}`,
    `DBE=${DATA_BLOCK_ELEMENT_LABELS[dbe] ?? String(dbe)}`,
  ];
  return parts.join(' · ');
}

function describeSvcStatus(word: number): string {
  return [
    `AHS=${word & 0x01}`,
    (word & 0x02) === 0 ? 'Idle' : 'Busy',
    (word & 0x04) === 0 ? 'No error' : 'SVC error',
    (word & 0x08) === 0 ? 'Not in process' : 'In process',
  ].join(' · ');
}

/**
 * C-DEV (MDT) / S-DEV (AT) kelimesi. Bit anlamları S `CSMD_C_DEV_*` /
 * `CSMD_S_DEV_*` sabitleriyle TEYİTLİ ve W'nin `hf_siii_at_dev_control_ident`
 * (0x8000) maskesiyle uyumlu. Girdi 4 bayttır: 2 bayt kelime + 2 bayt ayrılmış
 * (S `CSMD_C_DEV_LENGTH_CP1_2 4` yorumu birebir bunu diyor).
 */
function decodeDeviceWord(
  data: Uint8Array,
  offset: number,
  deviceIndex: number,
  isAt: boolean,
  fields: ParsedField[],
): void {
  const word = readUint16Le(data, offset);
  fields.push({
    id: `device-${deviceIndex}-word-${offset}`,
    name: `Device ${deviceIndex} — ${isAt ? 'S-DEV (Device Status)' : 'C-DEV (Device Control)'}`,
    offset,
    // 2 bayt kelime + 2 bayt ayrılmış; bölge dışında bir bayt kalmasın diye
    // alan girdinin TAMAMINI kapsar.
    length: DEVICE_ENTRY_LENGTH,
    rawBytes: data.slice(offset, offset + DEVICE_ENTRY_LENGTH),
    rawValue: word,
    physicalValue: isAt ? describeDeviceStatus(word) : describeDeviceControl(word),
    valid: true,
    warnings: [],
  });
}

/** S `CSMD_C_DEV_CMD_TOPOLOGY_*` ile birebir. */
const COMMANDED_TOPOLOGY_LABELS: readonly string[] = [
  'Fast forward on both ports',
  'Loopback, forward P-Telegrams',
  'Loopback, forward S-Telegrams',
  'Reserved',
];

function describeDeviceControl(word: number): string {
  return [
    (word & 0x8000) === 0 ? 'Ident off' : 'Ident LED',
    `TopologyHS=${(word >>> 14) & 0x01}`,
    COMMANDED_TOPOLOGY_LABELS[(word >>> 12) & 0x03] ?? '',
    (word & 0x0800) === 0 ? 'Ring open' : 'Ring closed',
    (word & 0x0100) === 0 ? 'Master invalid' : 'Master valid',
  ].join(' · ');
}

/** S `CSMD_S_DEV_STAT_INACT_*` ile birebir. */
const INACTIVE_PORT_LABELS: readonly string[] = [
  'No link on inactive port',
  'Link on inactive port',
  'P-telegram on inactive port',
  'S-telegram on inactive port',
];

function describeDeviceStatus(word: number): string {
  return [
    `TopologyHS=${(word >>> 14) & 0x01}`,
    COMMANDED_TOPOLOGY_LABELS[(word >>> 12) & 0x03] ?? '',
    INACTIVE_PORT_LABELS[(word >>> 10) & 0x03] ?? '',
    (word & 0x0100) === 0 ? 'Slave invalid' : 'Slave valid',
  ].join(' · ');
}

/**
 * CP3/CP4 gövdesi. Telgraf 0 sekiz baytlık Hot-Plug alanıyla başlar; gerisi
 * konfigürasyona bağlıdır ve TEK ÇERÇEVEDEN çıkarılamaz (dosya başı).
 */
function decodeCp34Body(
  data: Uint8Array,
  bodyStart: number,
  isAt: boolean,
  telegramNumber: number,
  fields: ParsedField[],
  warnings: WarningSink,
): number {
  let cursor = bodyStart;
  if (telegramNumber === 0 && data.length - bodyStart >= HOT_PLUG_LENGTH) {
    const address = readUint16Le(data, bodyStart);
    fields.push({
      id: `hot-plug-address-${bodyStart}`,
      name: 'Hot-Plug — Sercos Address',
      offset: bodyStart,
      length: 2,
      rawBytes: data.slice(bodyStart, bodyStart + 2),
      rawValue: address,
      valid: true,
      warnings: [],
    });

    // Bit adları (Switch to SVC / HP0 finished / Error / Parameter) yalnız
    // W'de — kelime tek alan olarak basılır, tek kaynak uyarısıyla.
    const wordOffset = bodyStart + 2;
    const word = readUint16Le(data, wordOffset);
    fields.push({
      id: `hot-plug-word-${wordOffset}`,
      name: `Hot-Plug — ${isAt ? 'HP Status' : 'HP Control'}`,
      offset: wordOffset,
      length: 2,
      rawBytes: data.slice(wordOffset, wordOffset + 2),
      rawValue: word,
      physicalValue: formatHex(word, 4),
      valid: true,
      warnings: [WARN_HOT_PLUG_BITS_SINGLE_SOURCE],
    });
    warnings.push(WARN_HOT_PLUG_BITS_SINGLE_SOURCE);

    pushRawBlock(fields, data, {
      id: `hot-plug-info-${bodyStart + 4}`,
      name: 'Hot-Plug — HP Info',
      offset: bodyStart + 4,
      length: 4,
    });
    cursor = bodyStart + HOT_PLUG_LENGTH;
  }

  const remaining = data.length - cursor;
  if (remaining > 0) {
    pushRawBlock(fields, data, {
      id: `cp34-payload-${cursor}`,
      name: 'CP3/CP4 — Service channel, device status and connections',
      offset: cursor,
      length: remaining,
      warnings: [WARN_CP34_LAYOUT_FROM_CP2],
    });
    warnings.push(WARN_CP34_LAYOUT_FROM_CP2);
  }
  return data.length;
}

function buildResult(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: WarningSink,
  errors: ProtocolError[],
  metadata: SercosIiiFrameMetadata,
  options: SercosIiiParseOptions,
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

  return { success: true, frame, consumedBytes: data.length };
}

function parseSercosIiiFrame(data: Uint8Array, options: SercosIiiParseOptions): ParseResult {
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

  if (data.length < MIN_HEADER_LENGTH + SERCOS_HEADER_LENGTH) {
    return fail({
      code: 'truncated-frame',
      message: ERROR_FRAME_TOO_SHORT,
      recoverable: true,
      offset: 0,
      length: data.length,
      details: {
        availableBytes: data.length,
        requiredBytes: MIN_HEADER_LENGTH + SERCOS_HEADER_LENGTH,
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

  const chain = walkTypeLengthChain(data, MAC_LENGTH * 2, fields, warnings.buffer, errors);
  warnings.drain();

  const unknownMetadata: SercosIiiFrameMetadata = {
    telegramType: undefined,
    phase: undefined,
    telegramNumber: undefined,
    summaryKey: SUMMARY_NOT_SERCOS,
    summaryParams,
  };

  const etherType = chain.finalValue;
  if (etherType === undefined) {
    return buildResult(data, fields, warnings, errors, unknownMetadata, options);
  }

  const etherTypeOffset = chain.cursor - TYPE_LENGTH_FIELD_LENGTH;
  const etherTypeMatches = etherType === SERCOS_ETHER_TYPE;
  fields.push({
    id: 'ethertype',
    name: 'EtherType',
    offset: etherTypeOffset,
    length: TYPE_LENGTH_FIELD_LENGTH,
    rawBytes: data.slice(etherTypeOffset, chain.cursor),
    rawValue: etherType,
    physicalValue: etherTypeMatches ? 'Sercos III' : formatHex(etherType, 4),
    valid: etherTypeMatches,
    warnings: etherTypeMatches ? [] : [ERROR_ETHER_TYPE_NOT_SERCOS],
  });

  if (!etherTypeMatches) {
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_ETHER_TYPE_NOT_SERCOS,
      offset: etherTypeOffset,
      length: TYPE_LENGTH_FIELD_LENGTH,
      details: {
        etherType: formatHex(etherType, 4),
        expected: formatHex(SERCOS_ETHER_TYPE, 4),
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
        warnings: [ERROR_ETHER_TYPE_NOT_SERCOS],
      });
    }
    summaryParams['etherType'] = formatHex(etherType, 4);
    return buildResult(data, fields, warnings, errors, unknownMetadata, options);
  }

  const headerStart = chain.cursor;
  if (data.length - headerStart < SERCOS_HEADER_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_HEADER_TRUNCATED,
      offset: headerStart,
      length: data.length - headerStart,
      details: {
        availableBytes: data.length - headerStart,
        requiredBytes: SERCOS_HEADER_LENGTH,
      },
    });
    return buildResult(data, fields, warnings, errors, unknownMetadata, options);
  }

  const header = decodeSercosHeader(data, headerStart, fields, warnings);

  summaryParams['telegram'] = `${header.isAt ? 'AT' : 'MDT'}${header.telegramNumber}`;
  summaryParams['phase'] = `CP${header.phase}${header.phaseSwitching ? ' (switching)' : ''}`;

  let consumedEnd = header.bodyStart;
  if (header.phase === 0) {
    consumedEnd = decodeCp0Body(data, header.bodyStart, header.isAt, fields, warnings);
  } else if (header.phase === 1 || header.phase === 2) {
    consumedEnd = decodeCp12Body(
      data,
      header.bodyStart,
      header.isAt,
      header.telegramNumber,
      fields,
      warnings,
    );
  } else if (header.phase === 3 || header.phase === 4) {
    consumedEnd = decodeCp34Body(
      data,
      header.bodyStart,
      header.isAt,
      header.telegramNumber,
      fields,
      warnings,
    );
  } else if (data.length > header.bodyStart) {
    // Adlandırılmamış faz: gövde biçimi bilinmiyor → ham + gerekçe.
    pushRawBlock(fields, data, {
      id: `payload-${header.bodyStart}`,
      name: 'Sercos III Payload',
      offset: header.bodyStart,
      length: data.length - header.bodyStart,
      warnings: [WARN_PHASE_NOT_NAMED],
    });
    consumedEnd = data.length;
  }

  appendPadding(data, consumedEnd, fields, warnings);

  return buildResult(
    data,
    fields,
    warnings,
    errors,
    {
      telegramType: header.isAt ? 'at' : 'mdt',
      phase: header.phase,
      telegramNumber: header.telegramNumber,
      summaryKey: header.isAt ? SUMMARY_AT : SUMMARY_MDT,
      summaryParams,
    },
    options,
  );
}

export function parseSercosIii(data: Uint8Array): ParseResult {
  return parseSercosIiiFrame(data, {});
}

export const sercosIiiParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: asgari uzunluk + EtherType 0x88CD (tek VLAN tag'e kadar). */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_HEADER_LENGTH + SERCOS_HEADER_LENGTH) return false;
    const first = (byteAt(data, MAC_LENGTH * 2) << 8) | byteAt(data, MAC_LENGTH * 2 + 1);
    if (first === SERCOS_ETHER_TYPE) return true;
    if (first !== VLAN_TPID) return false;
    if (data.length < MIN_HEADER_LENGTH + VLAN_TAG_LENGTH + SERCOS_HEADER_LENGTH) return false;
    const tagged =
      (byteAt(data, MAC_LENGTH * 2 + VLAN_TAG_LENGTH) << 8) |
      byteAt(data, MAC_LENGTH * 2 + VLAN_TAG_LENGTH + 1);
    return tagged === SERCOS_ETHER_TYPE;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: SercosIiiParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseSercosIiiFrame(data, options);
  },
};

// ── Örnek çerçeveler ────────────────────────────────────────────────────────
// Baytlar ELLE değil YAPIYA göre kurulur: bölge boyları sabitlerden HESAPLANIR
// (`SVC_REGION_LENGTH`, `DEVICE_REGION_LENGTH`), böylece bir sabit değişince
// örnek de değişir. DEĞERLER SENTETİKtir (yakalanmış Sercos III trafiği bu
// depoda yok) ama YAPI iki kaynaktan doğrulanmıştır; CRC32 alanı da sentetiktir
// ve zaten DOĞRULANMAZ (dosya başı).

/** Sercos III yayın MAC'i (W'nin örnek yakalamalarındaki gibi çok noktaya yayın). */
const MASTER_MAC = [0x02, 0x00, 0x00, 0x53, 0x33, 0x01];
const SLAVE_MAC = [0x02, 0x00, 0x00, 0x53, 0x33, 0x02];
const BROADCAST_MAC = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

function uint16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function uint32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function buildFrame(
  destination: readonly number[],
  source: readonly number[],
  typeByte: number,
  phaseByte: number,
  crc: number,
  body: readonly number[],
  padTo?: number,
): Uint8Array {
  const bytes = [
    ...destination,
    ...source,
    0x88,
    0xcd,
    typeByte,
    phaseByte,
    ...uint32(crc),
    ...body,
  ];
  if (padTo !== undefined) while (bytes.length < padTo) bytes.push(0x00);
  return Uint8Array.from(bytes);
}

/** Tek bir servis kanalı girdisi (6 bayt): kelime + bilgi. */
function svcEntry(word: number, info: number): number[] {
  return [...uint16(word), ...uint32(info)];
}

/** Tek bir C-DEV / S-DEV girdisi (4 bayt): kelime + 2 bayt ayrılmış. */
function deviceEntry(word: number): number[] {
  return [...uint16(word), 0x00, 0x00];
}

/**
 * Tam boy bir CP1/CP2 gövdesi: 768 bayt servis kanalı + 512 bayt cihaz
 * kontrol/durum. İlk üç cihaz anlamlı değer taşır, gerisi sıfırdır.
 */
function cp12Body(entries: ReadonlyArray<{ svc: number[]; device: number[] }>): number[] {
  const svcRegion: number[] = [];
  const deviceRegion: number[] = [];
  for (const entry of entries) {
    svcRegion.push(...entry.svc);
    deviceRegion.push(...entry.device);
  }
  while (svcRegion.length < SVC_REGION_LENGTH) svcRegion.push(0x00);
  while (deviceRegion.length < DEVICE_REGION_LENGTH) deviceRegion.push(0x00);
  return [...svcRegion, ...deviceRegion];
}

/** MDT tarafı: MHS=1, Write, EOT=0, DBE=IDN(1) → 0x000B. */
const MDT_SVC_WORD = 0x000b;
/** AT tarafı: AHS=1, Busy=0, Error=0, In process=1 → 0x0009. */
const AT_SVC_WORD = 0x0009;
/** C-DEV: Ident LED + ring closed + master valid → 0x8900. */
const C_DEV_WORD = 0x8900;
/** S-DEV: fast forward, link on inactive port, slave valid → 0x0500. */
const S_DEV_WORD = 0x0500;

const CP12_MDT_ENTRIES = [
  { svc: svcEntry(MDT_SVC_WORD, 0x00000064), device: deviceEntry(C_DEV_WORD) },
  { svc: svcEntry(MDT_SVC_WORD, 0x00000065), device: deviceEntry(C_DEV_WORD) },
  { svc: svcEntry(0x0000, 0x00000000), device: deviceEntry(0x0000) },
];

const CP12_AT_ENTRIES = [
  { svc: svcEntry(AT_SVC_WORD, 0x000003e8), device: deviceEntry(S_DEV_WORD) },
  { svc: svcEntry(AT_SVC_WORD, 0x000003e9), device: deviceEntry(S_DEV_WORD) },
  { svc: svcEntry(0x0004, 0x00000000), device: deviceEntry(0x0000) },
];

/** CP0/AT0 tanınan cihaz listesi: sıra sayacı + üç adres alanı. */
const CP0_AT_BODY = [
  ...uint16(0x0004), // sayaç: 4 → 3 tanınan cihaz
  ...uint16(0x0001),
  ...uint16(0x0002),
  ...uint16(0x0003),
  ...uint16(0xffff), // "cihaz yok" işaretçisi
];

/** CP3/CP4 hot-plug alanı + konfigürasyona bağlı gövde. */
const CP34_BODY = [
  ...uint16(0x0005), // Sercos adresi
  ...uint16(0x0100), // HP kontrol/durum kelimesi
  ...uint32(0x000003e8), // HP bilgi
  ...new Array<number>(40).fill(0x5a), // servis kanalı + bağlantılar (ham)
];

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'mdt0-cp4-operational',
    name: 'protocol.sercosIii.example.mdt0Cp4Operational.name',
    // P-Telegram, MDT, telgraf 0, cycle count geçerli (0x20) ve sayaç 3.
    bytes: buildFrame(BROADCAST_MAC, MASTER_MAC, 0x20, 0x34, 0x1a2b3c4d, CP34_BODY),
    description: 'protocol.sercosIii.example.mdt0Cp4Operational.description',
    expectedValid: true,
  },
  {
    id: 'at0-cp4-operational',
    name: 'protocol.sercosIii.example.at0Cp4Operational.name',
    // AT biti (0x40) set; aynı faz, aynı hot-plug yapısı, durum tarafı.
    bytes: buildFrame(BROADCAST_MAC, SLAVE_MAC, 0x60, 0x34, 0x4d3c2b1a, CP34_BODY),
    description: 'protocol.sercosIii.example.at0Cp4Operational.description',
    expectedValid: true,
  },
  {
    id: 'mdt0-cp0-communication-version',
    name: 'protocol.sercosIii.example.mdt0Cp0CommunicationVersion.name',
    bytes: buildFrame(
      BROADCAST_MAC,
      MASTER_MAC,
      0x20,
      0x00,
      0x00112233,
      uint32(0x00300100),
      60,
    ),
    description: 'protocol.sercosIii.example.mdt0Cp0CommunicationVersion.description',
    expectedValid: true,
  },
  {
    id: 'at0-cp0-recognized-devices',
    name: 'protocol.sercosIii.example.at0Cp0RecognizedDevices.name',
    bytes: buildFrame(BROADCAST_MAC, SLAVE_MAC, 0x60, 0x00, 0x00445566, CP0_AT_BODY, 60),
    description: 'protocol.sercosIii.example.at0Cp0RecognizedDevices.description',
    expectedValid: true,
  },
  {
    id: 'mdt0-cp2-service-channel',
    name: 'protocol.sercosIii.example.mdt0Cp2ServiceChannel.name',
    // Tam boy CP2 telgrafı: 14 + 6 + 768 + 512 = 1300 bayt.
    bytes: buildFrame(BROADCAST_MAC, MASTER_MAC, 0x20, 0x02, 0x0a0b0c0d, cp12Body(CP12_MDT_ENTRIES)),
    description: 'protocol.sercosIii.example.mdt0Cp2ServiceChannel.description',
    expectedValid: true,
  },
  {
    id: 'at1-cp2-second-device-group',
    name: 'protocol.sercosIii.example.at1Cp2SecondDeviceGroup.name',
    // Telgraf numarası 1 → cihaz indeksleri 128'den başlar.
    bytes: buildFrame(BROADCAST_MAC, SLAVE_MAC, 0x61, 0x02, 0x0d0c0b0a, cp12Body(CP12_AT_ENTRIES)),
    description: 'protocol.sercosIii.example.at1Cp2SecondDeviceGroup.description',
    expectedValid: true,
  },
  {
    id: 'mdt0-cp3-phase-switching',
    name: 'protocol.sercosIii.example.mdt0Cp3PhaseSwitching.name',
    // Faz baytı 0x83: CP3 + geçiş biti (0x80).
    bytes: buildFrame(BROADCAST_MAC, MASTER_MAC, 0x20, 0x83, 0x11223344, CP34_BODY),
    description: 'protocol.sercosIii.example.mdt0Cp3PhaseSwitching.description',
    expectedValid: true,
  },
  {
    id: 'mdt-secondary-channel',
    name: 'protocol.sercosIii.example.mdtSecondaryChannel.name',
    // Kanal biti (0x80) set → S-Telegram; cycle count valid biti SIFIR.
    bytes: buildFrame(BROADCAST_MAC, MASTER_MAC, 0x80, 0x04, 0x99887766, CP34_BODY),
    description: 'protocol.sercosIii.example.mdtSecondaryChannel.description',
    expectedValid: true,
  },
  {
    id: 'telegram-number-extended-bits',
    name: 'protocol.sercosIii.example.telegramNumberExtendedBits.name',
    // Bit 2-3 set: iki kaynak burada ANLAŞMIYOR (dosya başı) → ayrı alan + uyarı.
    bytes: buildFrame(BROADCAST_MAC, MASTER_MAC, 0x2e, 0x04, 0x12345678, CP34_BODY),
    description: 'protocol.sercosIii.example.telegramNumberExtendedBits.description',
    expectedValid: true,
  },
  {
    id: 'unknown-phase',
    name: 'protocol.sercosIii.example.unknownPhase.name',
    // Faz 7: iki kaynakta da adı yok → gövde ham + uyarı.
    bytes: buildFrame(BROADCAST_MAC, MASTER_MAC, 0x20, 0x07, 0x0f0f0f0f, CP34_BODY),
    description: 'protocol.sercosIii.example.unknownPhase.description',
    expectedValid: true,
  },
  {
    id: 'ethertype-not-sercos',
    name: 'protocol.sercosIii.example.etherTypeNotSercos.name',
    // CP4 örneğinin aynısı, EtherType kasten 0x0800 (IPv4).
    bytes: Uint8Array.from([
      ...BROADCAST_MAC,
      ...MASTER_MAC,
      0x08,
      0x00,
      0x20,
      0x34,
      ...uint32(0x1a2b3c4d),
      ...CP34_BODY,
    ]),
    description: 'protocol.sercosIii.example.etherTypeNotSercos.description',
    expectedValid: false,
  },
  {
    id: 'frame-too-short',
    name: 'protocol.sercosIii.example.frameTooShort.name',
    // 16 bayt: Ethernet başlığı var ama 6 baytlık Sercos başlığı yok.
    bytes: Uint8Array.from([...BROADCAST_MAC, ...MASTER_MAC, 0x88, 0xcd, 0x20, 0x34]),
    description: 'protocol.sercosIii.example.frameTooShort.description',
    expectedValid: false,
  },
];

export const sercosIiiPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: sercosIiiParser,
  documentation: {
    summary: 'protocol.sercosIii.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title:
          'Wireshark Sercos III dissector (packet-sercosiii.c, contributed by Bosch Rexroth / Hilscher)',
        url: 'https://github.com/wireshark/wireshark/blob/master/epan/dissectors/packet-sercosiii.c',
      },
      {
        title: 'Sercos Soft Master Core Library (SICE + CoSeMa, MIT) — frame and C-DEV/S-DEV layout',
        url: 'https://github.com/aschiffler/linuxcnc-sercos3',
      },
      {
        title: 'IEEE EtherType registry — 0x88CD, sercos international e.V., SERCOS interface',
        url: 'https://standards-oui.ieee.org/ethertype/eth.txt',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
