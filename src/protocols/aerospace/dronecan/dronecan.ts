/**
 * DroneCAN (UAVCAN v0) — CAN 2.0B taşıyıcısı üzerinde tek-çerçeve transfer çözümü.
 *
 * Faz 10, dalga 15a. Dalga 15'in AÇILIŞ alt dalgası: kaynak MÜKEMMEL, taşıyıcı
 * altı kez kanıtlı (`canFrame.ts` dosya başı — `isotp`/`j1939`/`canopen`/
 * `devicenet`/`ccp`/`xcpOnCan`/`nmea2000` aynı 16 baytlık SocketCAN konteynerini
 * paylaşıyor, DroneCAN sekizincisi), katalog eklemesi YOK (CRC zaten katalogda).
 *
 * ── GİRDİ: canFrame.ts'in SocketCAN konteyneri, TEL DEĞİL ──────────────────
 * `decodeSocketCanFrame`/`decodeCanId`/`readUint32Le`/`CAN_CLASSIC_FRAME_LENGTH`/
 * `CAN_HEADER_LENGTH`/`formatHex` `canFrame.ts`ten alınır. Ayrı bir CAN okuyucu
 * İKİNCİ KEZ YAZILMAZ (12d'nin "canFrame.ts'i biraz genişletme" isteğine
 * direnme kararı burada da geçerli — DroneCAN'e özel hiçbir şey oraya gitmez).
 *
 * ── CAN FD AÇIKÇA REDDEDİLİR (xcpOnCan.ts:169 emsali) ───────────────────────
 * DroneCAN v0 yalnız CAN 2.0B'dir — "Yalnız 29-bit CAN identifier kullanılır"
 * (`docs/spec/ozet/06-havacilik-uav.md:117`). Girdi tam `CAN_FD_FRAME_LENGTH`
 * (72 bayt) ise `unsupported-encoding` ile AÇIKÇA durur, sessizce yanlış
 * çözülmez.
 *
 * ── 29-BIT ZORUNLU ───────────────────────────────────────────────────────────
 * `decodeCanId` `extended: false` döndürürse çerçeve DroneCAN DEĞİLDİR:
 * `canParse` `false` döner, `parse` `value-out-of-range` ile uyarır ama
 * CAN ID/DLC/Data'yı yine de gösterir (spec §47 "hatalı veride uygulamayı
 * çökertme").
 *
 * ── KAYNAK TURU (2026-08-25, iki bağımsız kaynak DOĞRUDAN indirildi) ───────
 * 1. `docs/spec/ozet/06-havacilik-uav.md:109-156` — alan ADLARI, tail byte
 *    bit tablosu, `0xC5 = 11000101 → SOT=1,EOT=1,Toggle=0,TransferID=5`
 *    örneği, 4-frame toggle dizisi `0 1 0 1`, transfer ID wrap kuralı.
 *    VERMEDİĞİ: CAN ID alanlarının bit GENİŞLİKLERİ, transfer CRC parametreleri.
 * 2. Resmî UAVCAN v0 CAN taşıma spec'i, `legacy.uavcan.org/Specification/
 *    4._CAN_bus_transport_layer/` (dronecan.github.io'nun aynı metni; bugün
 *    dronecan.github.io/Specification/4._CAN_bus_transport_layer/ 404 verdi,
 *    bu yüzden legacy.uavcan.org kaynağı — brifin kendisinin "aynı metin
 *    legacy.uavcan.org'da" dediği ikinci adres — DOĞRUDAN kullanıldı) —
 *    "ID field" bölümü BİREBİR quote edildi, bit genişlikleri ve CRC
 *    parametreleri buradan geldi. Üçüncü, BAĞIMSIZ çapraz kaynak: libcanard
 *    (`github.com/dronecan/libcanard`, referans C uygulaması) — CRC-16
 *    (poly 0x1021, init 0xFFFF, bit-bit MSB-first, reflect YOK) ve CAN ID
 *    parse makroları (`PRIORITY_FROM_ID`: `>>24 & 0x1F`,
 *    `SERVICE_NOT_MSG_FROM_ID`: `>>7 & 0x1`, `DEST_ID_FROM_ID`: `>>8 & 0x7F`,
 *    `REQUEST_NOT_RESPONSE_FROM_ID`: `>>15 & 0x1`, `SRV_TYPE_FROM_ID`:
 *    `>>16 & 0xFF`, `MSG_TYPE_FROM_ID`: `>>8 & 0xFFFF`, `SOURCE_ID_FROM_ID`:
 *    `>>0 & 0x7F`) resmî spec'in "ID field" tablosuyla BİREBİR örtüştü.
 *    Tail byte, toggle semantiği, transfer ID genişliği zaten ana brifin
 *    dediği gibi İKİ kaynakta da (ozet + resmî spec) BİREBİR — üçüncü kaynak
 *    yalnız bit genişliklerini/kaydırmalarını PEKİŞTİRDİ.
 *    Anonymous message'ın Discriminator/Message-Type-ID-alt-bit sınırı
 *    (bit 23:10 / bit 9:8) resmî spec'in tablosundaki ALAN SIRASI ve
 *    GENİŞLİKLERİNDEN (Priority 5, Discriminator 14, alt bit 2, SNM 1,
 *    Source Node ID 7 — toplam 29) doğrudan ARİTMETİKLE türetildi; libcanard
 *    özetinin bu tek alt-alanda (discriminator kaydırması) verdiği rakam
 *    resmî spec tablosunun MSB'den LSB'ye sıralı genişlikleriyle ÇELİŞTİĞİ
 *    için KULLANILMADI — spec'in kendi tablosu (alan sırası + genişlik,
 *    ikisi de BİREBİR quote edildi) tek başına yeterli ve tutarlı.
 *
 * ── CAN ID ALAN DÜZENİ (29 bit, yüksekten alçağa) ───────────────────────────
 *   Message broadcast : Priority(5) · Message Type ID(16) · SNM(1)=0 · Source Node ID(7)=1..127
 *   Anonymous message  : Priority(5) · Discriminator(14) · Msg Type ID alt bit(2) · SNM(1)=0 · Source Node ID(7)=0
 *   Service            : Priority(5) · Service Type ID(8) · Request-Not-Response(1) · Destination Node ID(7) · SNM(1)=1 · Source Node ID(7)
 *
 * AYRIM KURALI — SIRA ÖNEMLİ (`decodeDroneCanIdentity`): (1) SNM biti (bit 7)
 * 1 ise Service; (2) SNM 0 VE Source Node ID 0 ise Anonymous message; (3) SNM
 * 0 VE Source Node ID 1..127 ise Message broadcast. Bu sırayı bozup önce
 * Source Node ID'ye bakmak anonim mesajları normal mesaj sanar.
 *
 * `ParsedField.offset`/`length` BAYT cinsindendir (`types.ts`, kilitli
 * sözleşme — DOKUNULMADI). CAN ID'nin bit alanları için kapsayan bayt aralığı
 * verilir (offset 0, length 4 — `readUint32Le`, `canFrame.ts:163`), bit
 * ayrıntısı alan ADINDA taşınır: `CAN ID · Priority (bit 28:24)` gibi
 * (`rtp.ts`/`rtcp.ts`in aynı bayta düşen bit alanlarını AYRI adlarla ayırma
 * emsali).
 *
 * ── TAIL BYTE (`data[headerLength+payloadLength-1]`, MSB'den) ──────────────
 *   Bit 7 Start Of Transfer · Bit 6 End Of Transfer · Bit 5 Toggle ·
 *   Bit 4:0 Transfer ID (5 bit, 0-31).
 * Spec örneği doğrulandı: `0xC5 = 11000101` → SOT=1, EOT=1, Toggle=0,
 * Transfer ID=5 (`dronecan.test.ts` bu değeri fixture olarak taşır — spec
 * §43 disiplini, CLAUDE.md). Dört alan AYRI çözülür; `Transfer ID`e `unit`
 * VERİLMEZ (sayaç, fiziksel değer değil).
 *
 * Toggle bit + SOT/EOT'tan çerçeve `single-frame` / `multi-frame-first` /
 * `multi-frame-middle` / `multi-frame-last` olarak SINIFLANIR (`summaryKey`/
 * `metadata.tailByte.frameRole` üzerinden) — bu sınıflama BEŞİNCİ bir
 * `ParsedField` DEĞİLDİR, tail byte hâlâ tam dört alandır.
 *
 * ── TRANSFER ID WRAP: BİLGİ, HATA DEĞİL ─────────────────────────────────────
 * 5 bitlik Transfer ID'nin 31→0 dönmesi GEÇERLİDİR (spec "Transfer ID"
 * bölümü: "When the stored transfer ID exceeds its maximum value, it will
 * roll over to zero."). Bu yüzden 0 ya da 31 değeri için EK bir uyarı
 * BASILMAZ — zaten çerçeveler arası karşılaştırma yapılmıyor (aşağı bakın).
 *
 * ── ÇERÇEVELER ARASI DURUM PARSER'A GİRMEZ (`mavlink.ts`in SEQ-LOSS kararı) ─
 * Toggle bitinin önceki çerçeveyle TUTARLI olup olmadığını izlemek (spec'in
 * "Reception" sözde kodu) ÇERÇEVELER ARASI durum ister — bu analyzer
 * katmanının işi. Bu parser SAF kalır (spec §41): tek çerçevede yalnız
 * SOT/EOT/Toggle/Transfer ID alanlarını çözer, bir önceki çerçeveyi HİÇ
 * bilmez. Aynı gerekçeyle **multi-frame reassembly YAZILMAZ** — katalog
 * `Multi-Frame Reassembly` aracını listeler ama bu çerçeveler arası bir
 * durumdur (analyzer işi); parser yalnız çerçeveyi sınıflar.
 *
 * ── TRANSFER CRC: GÖSTERİLİR, DOĞRULANMAZ (katalog eklemesi YOK) ───────────
 * Resmî spec: `CRC-16-CCITT-FALSE`, init `0xFFFF`, poly `0x1021`, reverse:
 * no, xorout: 0, check `0x29B1`. Depodaki `CRC16_CCITT_FALSE`
 * (`crcCatalogue.ts`) BİREBİR aynı — `computeNamedCrc` burada ÇAĞRILMAZ
 * çünkü:
 *  • **Single-frame transfer'de transfer CRC HİÇ YOKTUR** (spec: transfer
 *    CRC yalnız multi-frame transfer'lerde vardır) → doğrulanacak/gösterilecek
 *    bir CRC alanı yok, çerçeve TAM çözülür.
 *  • **Multi-frame transfer'de CRC vardır** ama girdisi "the transfer
 *    payload, prepended with a data type signature" — data type signature
 *    DSDL tanımından gelir ve depoda DSDL derleyicisi YOKTUR (bulgu 9,
 *    `snmp.ts:46`/`bleGatt.ts:34` "kanal boş" emsali). İlk çerçevenin ilk iki
 *    baytı (little-endian — UAVCAN'ın genel tel endianness kuralı;
 *    libcanard'ın CRC baytlarını düşük-önce gönderen davranışıyla tutarlı,
 *    ama resmî spec metni CRC'nin KENDİ bayt sırasını harfiyen yazmıyor —
 *    zaten bu yüzden DOĞRULANMIYOR, yalnız GÖSTERİLİYOR) `transfer-crc`
 *    alanı olarak GÖSTERİLİR, `transferCrcNeedsDataTypeSignature` uyarısıyla.
 * Bu, `mavlink.ts`in CRC_EXTRA durumundan FARKLIDIR: MAVLink'te HER
 * çerçevede doğrulanamayan bir CRC var; DroneCAN'de single-frame
 * çerçevelerde doğrulanacak CRC YOK. "Gösterilir" ile "doğrulanır" ayrımı
 * kullanıcıya her iki durumda da AÇIKÇA görünür (dalga 13 dersi 3).
 *
 * ── PAYLOAD HAM (DSDL kapsam dışı) ──────────────────────────────────────────
 * DSDL bit-packed alanlar tanımlar, byte hizalaması GARANTİ değildir (spec
 * ozet `:151`). Payload'a sabit offset'le alan adı YAKIŞTIRILMAZ; ham bayt +
 * `dsdlRequiredForPayload` uyarısı. Katalogda `definitions: ['dsdl']` ZATEN
 * yazılı; DSDL Browser paneli BOŞ kalır (`snmp.ts:46`/`bleGatt.ts:34` emsali)
 * — bu dosya o paneli doldurmaz.
 *
 * ── `decodeOptions` AÇILMAZ ──────────────────────────────────────────────────
 * DroneCAN'in çerçeve yorumu için seçenek gerekmiyor: CAN ID düzeni SNM
 * bitinden kesin türer, tail byte sabittir. Seçenek eklemek "gerekmediği
 * hâlde kanal açmak" olurdu (brief-faz10-dalga15a.md).
 *
 * ── KAPSAM DIŞI (bilinçli) ──────────────────────────────────────────────────
 * • Multi-frame reassembly, toggle sırası takibi — yukarı bakın.
 * • DSDL derleyicisi / mesaj adı sözlüğü — bulgu 9.
 * • Transfer CRC doğrulaması — data type signature yok.
 * • `cyphal`/`uavcan-compatibility` — 15b'nin işi, bu dosya yalnız DroneCAN
 *   çözücüsünü sağlar (15b bunu TÜKETECEK).
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

import { buildCanClassicFrame } from '../../automotive/can/canClassic';
import {
  CAN_CLASSIC_FRAME_LENGTH,
  CAN_CLASSIC_MAX_PAYLOAD,
  CAN_FD_FRAME_LENGTH,
  CAN_HEADER_LENGTH,
  decodeCanId,
  formatHex,
  readUint16Le,
  readUint32Le,
} from '../../automotive/can/canFrame';

const PROTOCOL_ID = 'dronecan';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md); katalog kaydıyla BİREBİR aynı. */
const PROTOCOL_DISPLAY_NAME = 'DroneCAN (UAVCAN v0)';

// ── CAN ID bit düzeni — resmî spec'ten (bkz. dosya başı "Kaynak turu") ──────
const PRIORITY_SHIFT = 24;
const PRIORITY_MASK = 0x1f; // 5 bit
const SERVICE_NOT_MESSAGE_SHIFT = 7;
const SOURCE_NODE_ID_MASK = 0x7f; // 7 bit, bit 6:0

const MESSAGE_TYPE_ID_SHIFT = 8;
const MESSAGE_TYPE_ID_MASK = 0xffff; // 16 bit, bit 23:8

const DISCRIMINATOR_SHIFT = 10;
const DISCRIMINATOR_MASK = 0x3fff; // 14 bit, bit 23:10
const MESSAGE_TYPE_ID_LOWER_SHIFT = 8;
const MESSAGE_TYPE_ID_LOWER_MASK = 0x3; // 2 bit, bit 9:8

const SERVICE_TYPE_ID_SHIFT = 16;
const SERVICE_TYPE_ID_MASK = 0xff; // 8 bit, bit 23:16
const REQUEST_NOT_RESPONSE_SHIFT = 15;
const DESTINATION_NODE_ID_SHIFT = 8;
const DESTINATION_NODE_ID_MASK = 0x7f; // 7 bit, bit 14:8

// ── Tail byte bit düzeni — spec ozet :134-139 + resmî spec "Payload" ───────
const TAIL_SOT_SHIFT = 7;
const TAIL_EOT_SHIFT = 6;
const TAIL_TOGGLE_SHIFT = 5;
const TAIL_TRANSFER_ID_MASK = 0x1f; // 5 bit, bit 4:0

const CAN_ID_FIELD_OFFSET = 0;
const CAN_ID_FIELD_LENGTH = 4;
const DLC_OFFSET = 4;
const TRANSFER_CRC_LENGTH = 2;

const ERROR_FRAME_TOO_SHORT = 'protocol.dronecan.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.dronecan.error.frameTooLong';
const ERROR_CAN_FD_NOT_SUPPORTED = 'protocol.dronecan.error.canFdNotSupported';
const ERROR_NOT_EXTENDED = 'protocol.dronecan.error.notExtended';
const ERROR_TAIL_BYTE_MISSING = 'protocol.dronecan.error.tailByteMissing';
const ERROR_ABORTED = 'protocol.dronecan.error.aborted';

const WARN_DSDL_REQUIRED_FOR_PAYLOAD = 'protocol.dronecan.warning.dsdlRequiredForPayload';
const WARN_TRANSFER_CRC_NEEDS_DATA_TYPE_SIGNATURE =
  'protocol.dronecan.warning.transferCrcNeedsDataTypeSignature';
const WARN_REMOTE_FRAME = 'protocol.dronecan.warning.remoteFrame';
const WARN_TRUNCATED_PAYLOAD = 'protocol.dronecan.warning.truncatedPayload';
const WARN_UNEXPECTED_TOGGLE_ON_SINGLE_FRAME =
  'protocol.dronecan.warning.unexpectedToggleOnSingleFrame';

const SUMMARY_PREFIX = 'protocol.dronecan.summary.';

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

// ── DroneCAN transfer identity (29-bit CAN ID'nin türevi) ──────────────────

export type DroneCanTransferKind =
  | 'message-broadcast'
  | 'anonymous-message'
  | 'service-request'
  | 'service-response';

export interface DroneCanMessageBroadcastIdentity {
  readonly kind: 'message-broadcast';
  readonly priority: number;
  readonly messageTypeId: number;
  readonly sourceNodeId: number;
}

export interface DroneCanAnonymousMessageIdentity {
  readonly kind: 'anonymous-message';
  readonly priority: number;
  readonly discriminator: number;
  readonly messageTypeIdLowerBits: number;
}

export interface DroneCanServiceIdentity {
  readonly kind: 'service-request' | 'service-response';
  readonly priority: number;
  readonly serviceTypeId: number;
  readonly destinationNodeId: number;
  readonly sourceNodeId: number;
}

export type DroneCanIdentity =
  | DroneCanMessageBroadcastIdentity
  | DroneCanAnonymousMessageIdentity
  | DroneCanServiceIdentity;

/**
 * 29-bit CAN identifier'ı DroneCAN transfer alanlarına ayırır. SIRA ÖNEMLİ
 * (dosya başı "Ayrım kuralı"): önce SNM biti, SONRA source node id bakılır —
 * tersi anonim mesajları normal mesaj sanır. Saf fonksiyon: testler ve
 * hesap araçları çerçeveden bağımsız çağırabilir (j1939.ts'in
 * `decodeJ1939Identifier`iyle aynı desen).
 */
export function decodeDroneCanIdentity(extendedId: number): DroneCanIdentity {
  const id = extendedId >>> 0;
  const priority = (id >>> PRIORITY_SHIFT) & PRIORITY_MASK;
  const serviceNotMessage = ((id >>> SERVICE_NOT_MESSAGE_SHIFT) & 0x1) === 1;

  if (serviceNotMessage) {
    const requestNotResponse = ((id >>> REQUEST_NOT_RESPONSE_SHIFT) & 0x1) === 1;
    return {
      kind: requestNotResponse ? 'service-request' : 'service-response',
      priority,
      serviceTypeId: (id >>> SERVICE_TYPE_ID_SHIFT) & SERVICE_TYPE_ID_MASK,
      destinationNodeId: (id >>> DESTINATION_NODE_ID_SHIFT) & DESTINATION_NODE_ID_MASK,
      sourceNodeId: id & SOURCE_NODE_ID_MASK,
    };
  }

  const sourceNodeId = id & SOURCE_NODE_ID_MASK;
  if (sourceNodeId === 0) {
    return {
      kind: 'anonymous-message',
      priority,
      discriminator: (id >>> DISCRIMINATOR_SHIFT) & DISCRIMINATOR_MASK,
      messageTypeIdLowerBits: (id >>> MESSAGE_TYPE_ID_LOWER_SHIFT) & MESSAGE_TYPE_ID_LOWER_MASK,
    };
  }

  return {
    kind: 'message-broadcast',
    priority,
    messageTypeId: (id >>> MESSAGE_TYPE_ID_SHIFT) & MESSAGE_TYPE_ID_MASK,
    sourceNodeId,
  };
}

const TRANSFER_TYPE_LABEL: Record<DroneCanTransferKind, string> = {
  'message-broadcast': 'Message Broadcast',
  'anonymous-message': 'Anonymous Message',
  'service-request': 'Service Request',
  'service-response': 'Service Response',
};

// ── Tail byte ────────────────────────────────────────────────────────────

export type DroneCanFrameRole =
  | 'single-frame'
  | 'multi-frame-first'
  | 'multi-frame-middle'
  | 'multi-frame-last';

export interface DroneCanTailByte {
  readonly startOfTransfer: boolean;
  readonly endOfTransfer: boolean;
  readonly toggle: boolean;
  readonly transferId: number;
  readonly frameRole: DroneCanFrameRole;
}

/** Spec örneği: `0xC5 = 11000101` → SOT=1, EOT=1, Toggle=0, Transfer ID=5. */
export function decodeDroneCanTailByte(tailByte: number): DroneCanTailByte {
  const startOfTransfer = ((tailByte >>> TAIL_SOT_SHIFT) & 0x1) === 1;
  const endOfTransfer = ((tailByte >>> TAIL_EOT_SHIFT) & 0x1) === 1;
  const toggle = ((tailByte >>> TAIL_TOGGLE_SHIFT) & 0x1) === 1;
  const transferId = tailByte & TAIL_TRANSFER_ID_MASK;

  let frameRole: DroneCanFrameRole;
  if (startOfTransfer && endOfTransfer) {
    frameRole = 'single-frame';
  } else if (startOfTransfer) {
    frameRole = 'multi-frame-first';
  } else if (endOfTransfer) {
    frameRole = 'multi-frame-last';
  } else {
    frameRole = 'multi-frame-middle';
  }

  return { startOfTransfer, endOfTransfer, toggle, transferId, frameRole };
}

const FRAME_ROLE_LABEL: Record<DroneCanFrameRole, string> = {
  'single-frame': 'Single-frame',
  'multi-frame-first': 'Multi-frame (first)',
  'multi-frame-middle': 'Multi-frame (middle)',
  'multi-frame-last': 'Multi-frame (last)',
};

// `interface` DEĞİL `type`: `RawFrameInit.metadata`nın beklediği
// `Record<string, unknown>`a atanabilirlik yalnız nesne-tipi `type`
// takma adlarında örtük index imzasıyla çalışır (j1939.ts'in
// `J1939FrameMetadata`si aynı sebeple `type`, `interface` değil).
export type DroneCanFrameMetadata = {
  readonly transfer?: DroneCanIdentity;
  readonly tailByte?: DroneCanTailByte;
  readonly payloadLength: number;
  readonly summaryKey: string;
  readonly summaryParams: Record<string, string>;
};

function canIdSubField(
  data: Uint8Array,
  id: string,
  name: string,
  rawValue: number | string,
  physicalValue?: string,
): ParsedField {
  return {
    id,
    name,
    offset: CAN_ID_FIELD_OFFSET,
    length: CAN_ID_FIELD_LENGTH,
    rawBytes: data.slice(CAN_ID_FIELD_OFFSET, CAN_ID_FIELD_OFFSET + CAN_ID_FIELD_LENGTH),
    rawValue,
    ...(physicalValue === undefined ? {} : { physicalValue }),
    valid: true,
    warnings: [],
  };
}

/** Transfer türüne göre CAN ID alt alanlarını üretir (dosya başı "Ayrım kuralı"). */
function buildTransferIdFields(data: Uint8Array, transfer: DroneCanIdentity): ParsedField[] {
  const fields: ParsedField[] = [
    canIdSubField(data, 'priority', 'CAN ID · Priority (bit 28:24)', transfer.priority),
  ];

  switch (transfer.kind) {
    case 'message-broadcast':
      fields.push(
        canIdSubField(
          data,
          'message-type-id',
          'CAN ID · Message Type ID (bit 23:8)',
          transfer.messageTypeId,
        ),
        canIdSubField(
          data,
          'service-not-message',
          'CAN ID · Service-Not-Message (bit 7)',
          0,
          'Message',
        ),
        canIdSubField(
          data,
          'source-node-id',
          'CAN ID · Source Node ID (bit 6:0)',
          transfer.sourceNodeId,
        ),
      );
      break;
    case 'anonymous-message':
      fields.push(
        canIdSubField(
          data,
          'discriminator',
          'CAN ID · Discriminator (bit 23:10)',
          transfer.discriminator,
        ),
        canIdSubField(
          data,
          'message-type-id-lower',
          'CAN ID · Message Type ID Lower Bits (bit 9:8)',
          transfer.messageTypeIdLowerBits,
        ),
        canIdSubField(
          data,
          'service-not-message',
          'CAN ID · Service-Not-Message (bit 7)',
          0,
          'Message',
        ),
        // Kaynak node id her zaman 0'dır (spec "ID field" — anonymous message satırı,
        // "Always zero") — sınıflamanın kendisi bu değere dayanır (dosya başı).
        canIdSubField(data, 'source-node-id', 'CAN ID · Source Node ID (bit 6:0)', 0, 'Anonymous'),
      );
      break;
    case 'service-request':
    case 'service-response':
      fields.push(
        canIdSubField(
          data,
          'service-type-id',
          'CAN ID · Service Type ID (bit 23:16)',
          transfer.serviceTypeId,
        ),
        canIdSubField(
          data,
          'request-not-response',
          'CAN ID · Request-Not-Response (bit 15)',
          transfer.kind === 'service-request' ? 1 : 0,
          transfer.kind === 'service-request' ? 'Request' : 'Response',
        ),
        canIdSubField(
          data,
          'destination-node-id',
          'CAN ID · Destination Node ID (bit 14:8)',
          transfer.destinationNodeId,
        ),
        canIdSubField(
          data,
          'service-not-message',
          'CAN ID · Service-Not-Message (bit 7)',
          1,
          'Service',
        ),
        canIdSubField(
          data,
          'source-node-id',
          'CAN ID · Source Node ID (bit 6:0)',
          transfer.sourceNodeId,
        ),
      );
      break;
  }

  fields.push(
    canIdSubField(data, 'transfer-type', 'CAN ID · Transfer Type', transfer.kind, TRANSFER_TYPE_LABEL[transfer.kind]),
  );
  return fields;
}

function buildTailByteFields(
  data: Uint8Array,
  tailByteOffset: number,
  tail: DroneCanTailByte,
  warnings: ProtocolWarning[],
): ParsedField[] {
  const tailBytes = data.slice(tailByteOffset, tailByteOffset + 1);
  const flagField = (id: string, name: string, active: boolean): ParsedField => ({
    id,
    name,
    offset: tailByteOffset,
    length: 1,
    rawBytes: tailBytes,
    rawValue: active ? 1 : 0,
    physicalValue: active ? 'Set' : 'Not set',
    valid: true,
    warnings: [],
  });

  const toggleField = flagField('tail-toggle', 'Tail · Toggle', tail.toggle);
  if (tail.frameRole === 'single-frame' && tail.toggle) {
    // Spec: single-frame transfer'de Toggle her zaman 0'dır (`canParse` bu
    // tutarlılığı zaten bir bekçi olarak kullanıyor). `parse()` doğrudan
    // çağrılabildiği için burada da işaretlenir — çökmez, yalnız uyarır.
    toggleField.valid = false;
    toggleField.warnings.push(WARN_UNEXPECTED_TOGGLE_ON_SINGLE_FRAME);
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_TOGGLE_ON_SINGLE_FRAME));
  }

  return [
    flagField('tail-sot', 'Tail · Start Of Transfer', tail.startOfTransfer),
    flagField('tail-eot', 'Tail · End Of Transfer', tail.endOfTransfer),
    toggleField,
    {
      id: 'tail-transfer-id',
      name: 'Tail · Transfer ID',
      offset: tailByteOffset,
      length: 1,
      rawBytes: tailBytes,
      rawValue: tail.transferId,
      // `unit` BİLEREK yok: sayaç, fiziksel değer değil (brief-faz10-dalga15a.md madde 4).
      valid: true,
      warnings: [],
    },
  ];
}

interface DroneCanParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseDroneCanFrame(data: Uint8Array, options: DroneCanParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < CAN_HEADER_LENGTH) {
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

  if (data.length === CAN_FD_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'unsupported-encoding',
        message: ERROR_CAN_FD_NOT_SUPPORTED,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const maxFrameLength = options.maxFrameLength ?? CAN_CLASSIC_FRAME_LENGTH;
  if (data.length > maxFrameLength) {
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

  const identity = decodeCanId(readUint32Le(data, 0));
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'can-id',
    name: 'CAN ID',
    offset: CAN_ID_FIELD_OFFSET,
    length: CAN_ID_FIELD_LENGTH,
    rawBytes: data.slice(CAN_ID_FIELD_OFFSET, CAN_ID_FIELD_OFFSET + CAN_ID_FIELD_LENGTH),
    rawValue: identity.id,
    physicalValue: identity.extended ? 'Extended / 29-bit' : 'Base / 11-bit',
    valid: identity.extended,
    warnings: [],
  });

  const declaredLength = byteAt(data, DLC_OFFSET);
  const availableAfterHeader = Math.max(0, data.length - CAN_HEADER_LENGTH);
  const payloadLength = Math.min(declaredLength, CAN_CLASSIC_MAX_PAYLOAD, availableAfterHeader);

  fields.push({
    id: 'dlc',
    name: 'DLC',
    offset: DLC_OFFSET,
    length: 1,
    rawBytes: data.slice(DLC_OFFSET, DLC_OFFSET + 1),
    rawValue: declaredLength,
    physicalValue: payloadLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  if (identity.remote) {
    // DroneCAN remote frame TANIMLAMAZ; bilgilendirici uyarı, çözüm sürer.
    warnings.push(toProtocolWarning(WARN_REMOTE_FRAME));
  }
  if (payloadLength < Math.min(declaredLength, CAN_CLASSIC_MAX_PAYLOAD)) {
    warnings.push(toProtocolWarning(WARN_TRUNCATED_PAYLOAD));
  }

  let transfer: DroneCanIdentity | undefined;
  let tail: DroneCanTailByte | undefined;

  if (!identity.extended) {
    // 29-bit zorunlu (dosya başı) — `canParse` bunu zaten elerdi ama `parse`
    // doğrudan çağrılabilir; kısmi bilgi gösterilir (spec §47).
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_NOT_EXTENDED,
      offset: CAN_ID_FIELD_OFFSET,
      length: CAN_ID_FIELD_LENGTH,
      details: { canId: formatHex(identity.id, 3), requiredFormat: 'extended' },
    });
    if (payloadLength > 0) {
      fields.push({
        id: 'data',
        name: 'Data',
        offset: CAN_HEADER_LENGTH,
        length: payloadLength,
        rawBytes: data.slice(CAN_HEADER_LENGTH, CAN_HEADER_LENGTH + payloadLength),
        valid: true,
        warnings: [],
      });
    }
  } else {
    transfer = decodeDroneCanIdentity(identity.id);
    fields.push(...buildTransferIdFields(data, transfer));

    if (payloadLength < 1) {
      // Gerçek bir DroneCAN çerçevesi HER ZAMAN en az tail byte'ı taşır
      // (DLC >= 1). `canParse` bunu zaten eler; burada yalnız savunma.
      errors.push({
        code: 'truncated-frame',
        message: ERROR_TAIL_BYTE_MISSING,
        offset: CAN_HEADER_LENGTH,
        length: 0,
      });
    } else {
      const tailByteOffset = CAN_HEADER_LENGTH + payloadLength - 1;
      tail = decodeDroneCanTailByte(byteAt(data, tailByteOffset));
      fields.push(...buildTailByteFields(data, tailByteOffset, tail, warnings));

      const bodyStart = CAN_HEADER_LENGTH;
      const bodyEnd = tailByteOffset; // tail byte hariç
      const bodyLength = Math.max(0, bodyEnd - bodyStart);

      if (tail.frameRole === 'multi-frame-first' && bodyLength > 0) {
        if (bodyLength >= TRANSFER_CRC_LENGTH) {
          fields.push({
            id: 'transfer-crc',
            name: 'Transfer CRC',
            offset: bodyStart,
            length: TRANSFER_CRC_LENGTH,
            rawBytes: data.slice(bodyStart, bodyStart + TRANSFER_CRC_LENGTH),
            rawValue: readUint16Le(data, bodyStart),
            valid: true,
            warnings: [WARN_TRANSFER_CRC_NEEDS_DATA_TYPE_SIGNATURE],
          });
          warnings.push(toProtocolWarning(WARN_TRANSFER_CRC_NEEDS_DATA_TYPE_SIGNATURE));

          const remainingStart = bodyStart + TRANSFER_CRC_LENGTH;
          if (bodyEnd > remainingStart) {
            fields.push({
              id: 'data',
              name: 'Data',
              offset: remainingStart,
              length: bodyEnd - remainingStart,
              rawBytes: data.slice(remainingStart, bodyEnd),
              valid: true,
              warnings: [WARN_DSDL_REQUIRED_FOR_PAYLOAD],
            });
            warnings.push(toProtocolWarning(WARN_DSDL_REQUIRED_FOR_PAYLOAD));
          }
        } else {
          // İlk çerçevede CRC'nin tamamını taşıyacak bayt yok (kısa/bozuk kayıt).
          fields.push({
            id: 'transfer-crc',
            name: 'Transfer CRC',
            offset: bodyStart,
            length: bodyLength,
            rawBytes: data.slice(bodyStart, bodyEnd),
            valid: false,
            warnings: [WARN_TRUNCATED_PAYLOAD],
          });
          warnings.push(toProtocolWarning(WARN_TRUNCATED_PAYLOAD));
        }
      } else if (bodyLength > 0) {
        fields.push({
          id: 'data',
          name: 'Data',
          offset: bodyStart,
          length: bodyLength,
          rawBytes: data.slice(bodyStart, bodyEnd),
          valid: true,
          warnings: [WARN_DSDL_REQUIRED_FOR_PAYLOAD],
        });
        warnings.push(toProtocolWarning(WARN_DSDL_REQUIRED_FOR_PAYLOAD));
      }
    }
  }

  let summaryKey: string;
  let summaryParams: Record<string, string>;
  if (transfer === undefined) {
    summaryKey = `${SUMMARY_PREFIX}notExtended`;
    summaryParams = {};
  } else {
    const frameRole = tail === undefined ? '—' : FRAME_ROLE_LABEL[tail.frameRole];
    switch (transfer.kind) {
      case 'message-broadcast':
        summaryKey = `${SUMMARY_PREFIX}messageBroadcast`;
        summaryParams = {
          frameRole,
          messageTypeId: String(transfer.messageTypeId),
          sourceNodeId: String(transfer.sourceNodeId),
        };
        break;
      case 'anonymous-message':
        summaryKey = `${SUMMARY_PREFIX}anonymousMessage`;
        summaryParams = { frameRole, discriminator: String(transfer.discriminator) };
        break;
      case 'service-request':
      case 'service-response':
        summaryKey =
          transfer.kind === 'service-request'
            ? `${SUMMARY_PREFIX}serviceRequest`
            : `${SUMMARY_PREFIX}serviceResponse`;
        summaryParams = {
          frameRole,
          serviceTypeId: String(transfer.serviceTypeId),
          sourceNodeId: String(transfer.sourceNodeId),
          destinationNodeId: String(transfer.destinationNodeId),
        };
        break;
    }
  }

  const metadata: DroneCanFrameMetadata = {
    ...(transfer === undefined ? {} : { transfer }),
    ...(tail === undefined ? {} : { tailByte: tail }),
    payloadLength,
    summaryKey,
    summaryParams,
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
    fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseDroneCan(data: Uint8Array): ParseResult {
  return parseDroneCanFrame(data, {});
}

export const droneCanParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Bekçi — bu konteyner `isotp`/`j1939`/`canopen`/`devicenet`/`ccp`/
   * `xcpOnCan`/`nmea2000` ile PAYLAŞILIYOR (dosya başı), çakışma riski
   * dalganın en yükseği. Brifin verdiği üç ölçüt (uzunluk+payload,
   * `extended`, single-frame tail byte tutarlılığı) İLK sürümde `dronecanCan
   * ParseRegistry.test.ts`i ÇALIŞTIRINCA `isotp`/`j1939`/`devicenet`/
   * `nmea2000`in 13 örneğini yanlış pozitif kabul ediyordu (14f'in "%54"
   * dersinin bu dalgadaki somut hâli, ÖLÇÜLDÜ 2026-08-25) — 12'si tam olarak
   * SOT=0/EOT=0 ("multi-frame-middle") görünüp başka HİÇBİR ek denetimden
   * geçmiyordu. Kök sebep tespit edilip iki tur EK ölçütle KAPATILDI, hepsi
   * resmî spec'ten (dosya başı "Kaynak turu"):
   *
   *  1. Tam `CAN_CLASSIC_FRAME_LENGTH` (16), `extended === true`, DLC 1..8.
   *  2. `multi-frame-middle` (SOT=0, EOT=0) KABUL EDİLMEZ. Tek çerçevede ne
   *     SOT ne EOT set — dört rolün en AZ kanıtlı olanı (izole çerçevede
   *     hiçbir çapa yok) ve ölçülen çarpışmaların ezici çoğunluğu (12/13) bu
   *     roldeydi — çoğu komşunun DLC=8'e dolgu SIFIR baytıyla tamamlaması bu
   *     deseni SİSTEMATİK üretiyor. Bu, "çerçeveler arası durum parser'a
   *     girmez" ilkesinin (dosya başı, mavlink.ts SEQ-LOSS emsali) doğal
   *     uzantısı: bir ORTA çerçevenin GERÇEKTEN DroneCAN olduğu ancak
   *     komşularıyla (analyzer katmanı) kanıtlanabilir, tek başına DEĞİL.
   *     `parse()` bunu ETKİLEMEZ — doğrudan çağrılan/örnekten seçilen bir
   *     orta çerçeve yine TAM çözülür, yalnız auto-detection'a aday olmaz.
   *  3. `single-frame` (SOT=1,EOT=1): Toggle MUTLAKA 0 (spec "Toggle bit").
   *  4. `multi-frame-first` (SOT=1,EOT=0): Toggle MUTLAKA 0 (spec: "starting
   *     at 0 for the first frame") VE DLC MUTLAKA 8 (spec: "The data field
   *     of all CAN frames of a multi-frame transfer, except the last one,
   *     must be filled/fully utilized").
   *  5. Anonim mesaj (SNM=0, Source Node ID=0) yalnız `single-frame`
   *     olabilir (spec: "An anonymous transfer can only be a single-frame
   *     transfer. Multi-frame anonymous messages are not allowed").
   *  6. Servis transferinde Source/Destination Node ID `0` OLAMAZ (spec
   *     "Node ID": "zero is reserved" — 1..127 zorunlu).
   *
   * `dronecanCanParseRegistry.test.ts` bunu tüm registry'ye karşı ÖLÇER ve
   * bu 13 örneğin ARTIK reddedildiğini bekçiler.
   */
  canParse(data: Uint8Array): boolean {
    if (data.length !== CAN_CLASSIC_FRAME_LENGTH) return false;

    const identity = decodeCanId(readUint32Le(data, 0));
    if (!identity.extended) return false;

    const declaredLength = byteAt(data, DLC_OFFSET);
    if (declaredLength < 1 || declaredLength > CAN_CLASSIC_MAX_PAYLOAD) return false;

    const tailByte = byteAt(data, CAN_HEADER_LENGTH + declaredLength - 1);
    const tail = decodeDroneCanTailByte(tailByte);

    // "Middle" en az kanıtlı roldür (ne SOT ne EOT) — ölçülen çarpışmaların
    // %92'si (12/13) buradaydı; bekçi bunu HİÇ kabul etmez (yukarı bakın).
    if (tail.frameRole === 'multi-frame-middle') return false;
    if (tail.frameRole === 'single-frame' && tail.toggle) return false;
    if (tail.frameRole === 'multi-frame-first' && (tail.toggle || declaredLength !== CAN_CLASSIC_MAX_PAYLOAD)) {
      return false;
    }

    const transfer = decodeDroneCanIdentity(identity.id);
    if (transfer.kind === 'anonymous-message' && tail.frameRole !== 'single-frame') return false;
    if (
      (transfer.kind === 'service-request' || transfer.kind === 'service-response') &&
      (transfer.sourceNodeId === 0 || transfer.destinationNodeId === 0)
    ) {
      return false;
    }

    return true;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: DroneCanParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseDroneCanFrame(data, options);
  },
};

/** Tail byte baytını SOT/EOT/Toggle/Transfer ID'den kurar (örnek çerçeveler için). */
function buildTailByteValue(
  startOfTransfer: boolean,
  endOfTransfer: boolean,
  toggle: boolean,
  transferId: number,
): number {
  return (
    ((startOfTransfer ? 1 : 0) << TAIL_SOT_SHIFT) |
    ((endOfTransfer ? 1 : 0) << TAIL_EOT_SHIFT) |
    ((toggle ? 1 : 0) << TAIL_TOGGLE_SHIFT) |
    (transferId & TAIL_TRANSFER_ID_MASK)
  );
}

function encodeMessageBroadcastId(priority: number, messageTypeId: number, sourceNodeId: number): number {
  return (
    ((priority & PRIORITY_MASK) << PRIORITY_SHIFT) |
    ((messageTypeId & MESSAGE_TYPE_ID_MASK) << MESSAGE_TYPE_ID_SHIFT) |
    (sourceNodeId & SOURCE_NODE_ID_MASK)
  ) >>> 0;
}

function encodeAnonymousMessageId(
  priority: number,
  discriminator: number,
  messageTypeIdLowerBits: number,
): number {
  return (
    ((priority & PRIORITY_MASK) << PRIORITY_SHIFT) |
    ((discriminator & DISCRIMINATOR_MASK) << DISCRIMINATOR_SHIFT) |
    ((messageTypeIdLowerBits & MESSAGE_TYPE_ID_LOWER_MASK) << MESSAGE_TYPE_ID_LOWER_SHIFT)
  ) >>> 0;
}

function encodeServiceId(
  priority: number,
  serviceTypeId: number,
  requestNotResponse: boolean,
  destinationNodeId: number,
  sourceNodeId: number,
): number {
  return (
    ((priority & PRIORITY_MASK) << PRIORITY_SHIFT) |
    ((serviceTypeId & SERVICE_TYPE_ID_MASK) << SERVICE_TYPE_ID_SHIFT) |
    ((requestNotResponse ? 1 : 0) << REQUEST_NOT_RESPONSE_SHIFT) |
    ((destinationNodeId & DESTINATION_NODE_ID_MASK) << DESTINATION_NODE_ID_SHIFT) |
    (0x1 << SERVICE_NOT_MESSAGE_SHIFT) |
    (sourceNodeId & SOURCE_NODE_ID_MASK)
  ) >>> 0;
}

/**
 * Örnek çerçeveler `buildCanClassicFrame`den kurulur (j1939.ts/xcpOnCan.ts
 * emsali), CAN ID'ler yukarıdaki `encode*` yardımcılarıyla — DECODER'ın AYNI
 * kaydırma/maske sabitlerini kullanır, böylece örnekler kod ile SİMETRİK
 * kalır. J1939'un aksine DroneCAN'in resmî spec'i tam bir CAN ID sayısı
 * ÖRNEĞİ VERMEZ (yalnız alan/bit tablosu) — bu yüzden tek bağımsız, spec'ten
 * BİREBİR alınan sayısal fixture tail byte örneğidir: `0xC5` (spec, dosya
 * başı) `message-broadcast-single-frame`de KULLANILIR.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'message-broadcast-single-frame',
    name: 'protocol.dronecan.example.messageBroadcastSingleFrame.name',
    // Priority 20, Message Type ID 1000, Source Node 42; tail 0xC5 = spec
    // örneği (SOT=1,EOT=1,Toggle=0,TransferID=5).
    bytes: buildCanClassicFrame(
      encodeMessageBroadcastId(20, 1000, 42),
      [0x01, 0x02, 0x03, buildTailByteValue(true, true, false, 5)],
      { extended: true },
    ),
    description: 'protocol.dronecan.example.messageBroadcastSingleFrame.description',
    expectedValid: true,
  },
  {
    id: 'anonymous-message-single-frame',
    name: 'protocol.dronecan.example.anonymousMessageSingleFrame.name',
    // Source Node ID her zaman 0 — dynamic node ID allocation senaryosu.
    bytes: buildCanClassicFrame(
      encodeAnonymousMessageId(10, 0x1234, 2),
      [0xaa, buildTailByteValue(true, true, false, 0)],
      { extended: true },
    ),
    description: 'protocol.dronecan.example.anonymousMessageSingleFrame.description',
    expectedValid: true,
  },
  {
    id: 'service-request-single-frame',
    name: 'protocol.dronecan.example.serviceRequestSingleFrame.name',
    bytes: buildCanClassicFrame(
      encodeServiceId(25, 1, true, 42, 10),
      [0x00, buildTailByteValue(true, true, false, 1)],
      { extended: true },
    ),
    description: 'protocol.dronecan.example.serviceRequestSingleFrame.description',
    expectedValid: true,
  },
  {
    id: 'service-response-single-frame',
    name: 'protocol.dronecan.example.serviceResponseSingleFrame.name',
    bytes: buildCanClassicFrame(
      encodeServiceId(25, 1, false, 10, 42),
      [0x00, 0x01, buildTailByteValue(true, true, false, 1)],
      { extended: true },
    ),
    description: 'protocol.dronecan.example.serviceResponseSingleFrame.description',
    expectedValid: true,
  },
  {
    id: 'multi-frame-first',
    name: 'protocol.dronecan.example.multiFrameFirst.name',
    // İlk iki bayt transfer CRC (gösterilir, DOĞRULANMAZ — data type signature yok).
    bytes: buildCanClassicFrame(
      encodeMessageBroadcastId(16, 777, 100),
      [0x34, 0x12, 0x11, 0x22, 0x33, 0x44, 0x55, buildTailByteValue(true, false, false, 3)],
      { extended: true },
    ),
    description: 'protocol.dronecan.example.multiFrameFirst.description',
    expectedValid: true,
  },
  {
    id: 'multi-frame-middle',
    name: 'protocol.dronecan.example.multiFrameMiddle.name',
    // Aynı mantıksal transfer'in devamı — Toggle 0→1 (parser çerçeveler
    // arası KARŞILAŞTIRMAZ, bu yalnız anlatım amaçlı bir devam örneğidir).
    bytes: buildCanClassicFrame(
      encodeMessageBroadcastId(16, 777, 100),
      [0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, buildTailByteValue(false, false, true, 3)],
      { extended: true },
    ),
    description: 'protocol.dronecan.example.multiFrameMiddle.description',
    expectedValid: true,
  },
  {
    id: 'multi-frame-last',
    name: 'protocol.dronecan.example.multiFrameLast.name',
    bytes: buildCanClassicFrame(
      encodeMessageBroadcastId(16, 777, 100),
      [0xdd, 0xee, buildTailByteValue(false, true, false, 3)],
      { extended: true },
    ),
    description: 'protocol.dronecan.example.multiFrameLast.description',
    expectedValid: true,
  },
  {
    id: 'not-extended-rejected',
    name: 'protocol.dronecan.example.notExtendedRejected.name',
    // 11-bit (base) identifier: DroneCAN 29-bit ZORUNLU kılar (dosya başı).
    bytes: buildCanClassicFrame(0x123, [0xaa, 0xbb]),
    description: 'protocol.dronecan.example.notExtendedRejected.description',
    expectedValid: false,
  },
];

export const droneCanPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: droneCanParser,
  documentation: {
    summary: 'protocol.dronecan.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'UAVCAN v0 Specification — 4. CAN bus transport layer (legacy.uavcan.org)',
        url: 'https://legacy.uavcan.org/Specification/4._CAN_bus_transport_layer/',
      },
      {
        title: 'libcanard — reference C implementation of DroneCAN/UAVCAN v0 (MIT)',
        url: 'https://github.com/dronecan/libcanard',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
