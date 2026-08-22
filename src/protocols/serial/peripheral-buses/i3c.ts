/**
 * I3C — SDR trafiği, ENTDAA, CCC ve IBI çözümü. Faz 10, dalga 11 (#11).
 *
 * Sabitlerin kaynak doğrulaması `i3cCore.ts` dosya başındadır (Linux çekirdeği
 * I3C alt sistemi; MIPI spec'i kamuya açık değil). Bu dosya yalnız YAKALANMIŞ
 * BAYT DİZİSİNİ dört şekle ayırır ve alan tablosunu kurar.
 *
 * ── Dört şekil ────────────────────────────────────────────────────────────
 * 1. **CCC** — ilk bayt `0xFC` (0x7E<<1 | W, ayrılmış broadcast adresi).
 *    İkinci bayt CCC kodu; bit 7 kuruluysa Direct, değilse Broadcast.
 *    Broadcast'te kalan baytlar doğrudan payload; Direct'te sıradaki bayt
 *    repeated-START sonrası HEDEF adresidir, kalanı payload.
 * 2. **ENTDAA** — CCC kodu `0x07`. Ardından `0xFD` (0x7E<<1 | R) ve her hedef
 *    için 8 baytlık tanıtım (PID 6 + BCR 1 + DCR 1) ile onu izleyen 1 baytlık
 *    atanan adres. Spec'in "bus discovery görünümü" ve "Dynamic address"
 *    istediği tablo budur.
 * 3. **Private SDR** — ilk bayt `0xFC` DEĞİL: doğrudan hedefin dinamik
 *    adresi + R/W, kalanı veri.
 * 4. **IBI** — hedef kendi adresini + R ile sürer, ardından (BCR bit 2
 *    kuruluysa) Mandatory Data Byte ve payload gelir.
 *
 * ── Kaçınılmaz belirsizlik ve nasıl ele alındı ────────────────────────────
 * **3 ile 4 yakalanmış baytlardan AYIRT EDİLEMEZ.** Bir private SDR read
 * (`addr+R, data…`) ile bir IBI (`addr+R, MDB, payload…`) bit bit AYNI
 * görünür — ayrım transaction'ı KİMİN başlattığındadır (controller mı hedef
 * mi) ve bu bilgi bayt dizisinde yoktur.
 *
 * Bu yüzden Microwire'la aynı dalgada açılan `decodeOptions` kanalı burada da
 * kullanılıyor: `frameKind` şıkkı `auto`da 0xFC'ye bakıp CCC/ENTDAA ayırır,
 * kalanını private SDR sayar ve "bu bir IBI de olabilir" UYARISINI basar;
 * kullanıcı biliyorsa `ibi` seçer ve MDB doğru adlandırılır. Belirsizlik
 * gizlenmez, kullanıcıya sorulur — smbus'ın `alternativeKinds` kararının
 * bir sonraki adımı (orada seçenek kanalı yoktu, artık var).
 *
 * ── KAPSAM DIŞI (gerekçeli) ───────────────────────────────────────────────
 * - **HDR trafiği ve Hot-Join el sıkışması** — `i3cCore.ts` dosya başındaki
 *   gerekçe: spec ikisini de yalnız ADIYLA sayıyor, kernel başlığında da
 *   yalnız GİRİŞ komutları (`ENTHDR0..7`, `ENEC` HJ biti) var. `ENTHDR`
 *   komutu TANINIR, sonrasındaki HDR çerçeveleri çözülmez.
 * - **12.5 / 33.3 Mbit/s** — versiyon-bağımlı, doğrulanamadı; hiçbir yerde
 *   sabitlenmedi, katalogda `timing` sekmesi AÇILMADI.
 * - **ACK/NACK, arbitration, clock stretch** — bit-seviyeli elektriksel
 *   sinyal; i2c.ts'in aynı kararı.
 * - Katalogun `tools` listesindeki "SDR Traffic"/"HDR Traffic"/"Hot-Join
 *   Monitor"/"Diagnostics" bu motorun tam karşılığı DEĞİL (onewire.ts'in
 *   aspirasyonel tools-listesi disiplini).
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import {
  I3C_BROADCAST_ADDRESS,
  I3C_DAA_DESCRIPTOR_LENGTH,
  I3C_PID_BYTE_LENGTH,
  decodeBcr,
  decodeDcr,
  decodeEventMask,
  decodePid,
  decodeStatus,
  i3cAddress7Bit,
  i3cIsBroadcastAddress,
  i3cIsReadAddress,
  lookupCcc,
} from './i3cCore';

/** Katalogdaki kayıt id'siyle birebir aynı olmalı (`src/app/catalog`, plugin bağı budur). */
const PROTOCOL_ID = 'i3c';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'I3C';

const HEX_RADIX = 16;
const MIN_FRAME_LENGTH = 1;

/** 0x7E<<1 | W ve 0x7E<<1 | R — ayrılmış broadcast adresinin iki yönü. */
const BROADCAST_WRITE_BYTE = (I3C_BROADCAST_ADDRESS << 1) & 0xff;
const BROADCAST_READ_BYTE = BROADCAST_WRITE_BYTE | 0x01;

const CCC_ENTDAA = 0x07;
const CCC_ENEC = 0x00;
const CCC_DISEC = 0x01;
const CCC_ENEC_DIRECT = 0x80;
const CCC_DISEC_DIRECT = 0x81;
const CCC_GETSTATUS = 0x90;
const CCC_GETPID = 0x8d;
const CCC_GETBCR = 0x8e;
const CCC_GETDCR = 0x8f;

const OPTION_FRAME_KIND = 'frameKind';
const FRAME_KIND_AUTO = 'auto';
const FRAME_KIND_CCC = 'ccc';
const FRAME_KIND_PRIVATE = 'private-sdr';
const FRAME_KIND_IBI = 'ibi';

const ERROR_EMPTY_FRAME = 'protocol.i3c.error.emptyFrame';
const ERROR_CCC_MISSING_CODE = 'protocol.i3c.error.cccMissingCode';
const ERROR_DIRECT_MISSING_TARGET = 'protocol.i3c.error.directMissingTarget';

const WARNING_IBI_AMBIGUOUS = 'protocol.i3c.warning.ibiAmbiguous';
const WARNING_DAA_PARITY_ASSUMED = 'protocol.i3c.warning.daaParityAssumed';
const WARNING_DAA_TRUNCATED = 'protocol.i3c.warning.daaTruncated';
const WARNING_UNKNOWN_CCC = 'protocol.i3c.warning.unknownCcc';
const WARNING_VENDOR_CCC = 'protocol.i3c.warning.vendorCcc';
const WARNING_UNKNOWN_DCR = 'protocol.i3c.warning.unknownDcr';
const WARNING_ENTHDR_OPAQUE = 'protocol.i3c.warning.entHdrOpaque';
const WARNING_PID_RANDOM = 'protocol.i3c.warning.pidRandom';

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_FRAME_KIND,
    label: 'protocol.i3c.option.frameKind',
    kind: 'select',
    defaultValue: FRAME_KIND_AUTO,
    description: 'protocol.i3c.option.frameKind.description',
    choices: [
      { value: FRAME_KIND_AUTO, label: 'protocol.i3c.option.frameKind.auto' },
      { value: FRAME_KIND_CCC, label: 'protocol.i3c.option.frameKind.ccc' },
      { value: FRAME_KIND_PRIVATE, label: 'protocol.i3c.option.frameKind.private' },
      { value: FRAME_KIND_IBI, label: 'protocol.i3c.option.frameKind.ibi' },
    ],
  },
];

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

function addressField(
  id: string,
  name: string,
  data: Uint8Array,
  offset: number,
): ParsedField {
  const value = byteAt(data, offset);
  return {
    id,
    name,
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: formatHexByte(value),
    physicalValue: `${i3cIsReadAddress(value) ? 'Read' : 'Write'} · 7-bit ${formatHexByte(i3cAddress7Bit(value))}`,
    valid: true,
    warnings: [],
  };
}

function payloadField(data: Uint8Array, offset: number, name: string): ParsedField | undefined {
  if (offset >= data.length) return undefined;
  return {
    id: 'payload',
    name,
    offset,
    length: data.length - offset,
    rawBytes: data.slice(offset),
    unit: 'B',
    valid: true,
    warnings: [],
  };
}

/** ENEC/DISEC gövdesi tek bayt olay maskesidir (`struct i3c_ccc_events`). */
function eventMaskField(data: Uint8Array, offset: number): ParsedField {
  const mask = byteAt(data, offset);
  const names = decodeEventMask(mask);
  return {
    id: 'events',
    name: 'Event Mask',
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: formatHexByte(mask),
    // Bilinen üç bitin hiçbiri kurulu değilse "hiçbiri" YAZILMAZ; ayrılmış
    // bitler adlandırılmadığı için boş liste dürüst cevaptır.
    physicalValue: names.length === 0 ? formatHexByte(mask) : names.join(' · '),
    valid: true,
    warnings: [],
  };
}

function bcrField(data: Uint8Array, offset: number, idSuffix: string): ParsedField {
  const bcr = byteAt(data, offset);
  const decoded = decodeBcr(bcr);
  const flags: string[] = [decoded.role];
  if (decoded.hdrCapable) flags.push('HDR');
  if (decoded.bridge) flags.push('Bridge');
  if (decoded.offlineCapable) flags.push('Offline');
  if (decoded.ibiRequestCapable) flags.push('IBI req');
  if (decoded.ibiPayload) flags.push('IBI payload');
  if (decoded.maxDataSpeedLimited) flags.push('Speed limited');

  return {
    id: `bcr${idSuffix}`,
    name: 'BCR',
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: formatHexByte(bcr),
    physicalValue: flags.join(' · '),
    valid: true,
    warnings: [],
  };
}

function dcrField(
  data: Uint8Array,
  offset: number,
  idSuffix: string,
): { field: ParsedField; unknown: boolean } {
  const dcr = byteAt(data, offset);
  const name = decodeDcr(dcr);
  return {
    unknown: name === undefined,
    field: {
      id: `dcr${idSuffix}`,
      name: 'DCR',
      offset,
      length: 1,
      rawBytes: data.slice(offset, offset + 1),
      rawValue: formatHexByte(dcr),
      // Bilinmeyen DCR'ye sınıf adı UYDURULMAZ — ham bayt basılır.
      ...(name === undefined ? {} : { physicalValue: name }),
      valid: true,
      warnings: [],
    },
  };
}

function pidField(
  data: Uint8Array,
  offset: number,
  idSuffix: string,
): { field: ParsedField; random: boolean } {
  const decoded = decodePid(data.slice(offset, offset + I3C_PID_BYTE_LENGTH));
  const parts = [`Manufacturer ${formatHexByte(decoded.manufacturerId)}`];
  if (decoded.randomLower32) {
    // Alt 32 bit RASTGELE: part/instance BASILMAZ, çünkü o bitler kimlik değil.
    parts.push(`Random 0x${(decoded.randomValue ?? 0).toString(HEX_RADIX).toUpperCase()}`);
  } else {
    parts.push(`Part ${formatHexByte(decoded.partId ?? 0)}`);
    parts.push(`Instance ${String(decoded.instanceId ?? 0)}`);
  }

  return {
    random: decoded.randomLower32,
    field: {
      id: `pid${idSuffix}`,
      name: 'PID',
      offset,
      length: I3C_PID_BYTE_LENGTH,
      rawBytes: data.slice(offset, offset + I3C_PID_BYTE_LENGTH),
      rawValue: `0x${decoded.raw.toString(HEX_RADIX).toUpperCase().padStart(12, '0')}`,
      physicalValue: parts.join(' · '),
      valid: true,
      warnings: [],
    },
  };
}

interface I3cParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  options?: Record<string, unknown>;
}

type I3cShape = 'ccc' | 'entdaa' | 'private-sdr' | 'ibi';

interface I3cFrameMetadata extends Record<string, unknown> {
  readonly shape: I3cShape;
  readonly cccName?: string;
}

function resolveRequestedKind(options: Record<string, unknown> | undefined): string {
  const requested = options?.[OPTION_FRAME_KIND];
  return typeof requested === 'string' ? requested : FRAME_KIND_AUTO;
}

/** ENTDAA gövdesini hedef hedef çözer: 8 baytlık tanıtım + 1 baytlık atanan adres. */
function decodeDaaTargets(
  data: Uint8Array,
  startOffset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  const stride = I3C_DAA_DESCRIPTOR_LENGTH + 1;
  let offset = startOffset;
  let index = 0;
  let parityAssumed = false;
  let sawRandomPid = false;
  let sawUnknownDcr = false;

  while (offset < data.length) {
    const remaining = data.length - offset;
    if (remaining < I3C_DAA_DESCRIPTOR_LENGTH) {
      // Yarım tanıtım bloğu: yorumlanmaz, ham kuyruk olarak basılır.
      warnings.push({ code: 'daa-truncated', message: WARNING_DAA_TRUNCATED, offset });
      const tail = payloadField(data, offset, 'Unparsed tail');
      if (tail !== undefined) fields.push(tail);
      break;
    }

    const suffix = `-${String(index)}`;
    const pid = pidField(data, offset, suffix);
    fields.push(pid.field);
    if (pid.random) sawRandomPid = true;

    fields.push(bcrField(data, offset + I3C_PID_BYTE_LENGTH, suffix));

    const dcr = dcrField(data, offset + I3C_PID_BYTE_LENGTH + 1, suffix);
    fields.push(dcr.field);
    if (dcr.unknown) sawUnknownDcr = true;

    const addressOffset = offset + I3C_DAA_DESCRIPTOR_LENGTH;
    if (addressOffset < data.length) {
      const assigned = byteAt(data, addressOffset);
      parityAssumed = true;
      fields.push({
        id: `assignedAddress${suffix}`,
        name: 'Assigned Dynamic Address',
        offset: addressOffset,
        length: 1,
        rawBytes: data.slice(addressOffset, addressOffset + 1),
        rawValue: formatHexByte(assigned),
        // VARSAYIM: adres-baytı konvansiyonu (DA<<1 | parite). Kaynak bunu
        // sabitlemiyor — uyarı olarak basılıyor (dosya başı + i3cCore.ts).
        physicalValue: `DA ${formatHexByte(i3cAddress7Bit(assigned))}`,
        valid: true,
        warnings: [],
      });
    } else {
      warnings.push({ code: 'daa-truncated', message: WARNING_DAA_TRUNCATED, offset: addressOffset });
    }

    offset += stride;
    index += 1;
  }

  if (parityAssumed) {
    warnings.push({ code: 'daa-parity-assumed', message: WARNING_DAA_PARITY_ASSUMED });
  }
  if (sawRandomPid) warnings.push({ code: 'pid-random', message: WARNING_PID_RANDOM });
  if (sawUnknownDcr) warnings.push({ code: 'unknown-dcr', message: WARNING_UNKNOWN_DCR });
}

function parseI3cFrame(data: Uint8Array, parseOptions: I3cParseOptions): ParseResult {
  if (data.length < MIN_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_EMPTY_FRAME,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: MIN_FRAME_LENGTH },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const requestedKind = resolveRequestedKind(parseOptions.options);
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];

  const firstByte = byteAt(data, 0);
  const looksLikeCcc = firstByte === BROADCAST_WRITE_BYTE;
  const treatAsCcc = requestedKind === FRAME_KIND_CCC || (requestedKind === FRAME_KIND_AUTO && looksLikeCcc);

  if (treatAsCcc) {
    if (data.length < 2) {
      return {
        success: false,
        error: { code: 'truncated-frame', message: ERROR_CCC_MISSING_CODE, offset: 0, length: data.length },
        consumedBytes: 0,
        recoverable: false,
      };
    }

    fields.push(addressField('broadcastAddress', 'Reserved Broadcast Address', data, 0));

    const cccCode = byteAt(data, 1);
    const ccc = lookupCcc(cccCode);
    fields.push({
      id: 'ccc',
      name: 'CCC',
      offset: 1,
      length: 1,
      rawBytes: data.slice(1, 2),
      rawValue: formatHexByte(cccCode),
      physicalValue: `${ccc.name} · ${ccc.kind === 'direct' ? 'Direct' : 'Broadcast'}`,
      valid: true,
      warnings: [],
    });
    if (ccc.unknown) warnings.push({ code: 'unknown-ccc', message: WARNING_UNKNOWN_CCC, offset: 1 });
    if (ccc.vendorDefined) warnings.push({ code: 'vendor-ccc', message: WARNING_VENDOR_CCC, offset: 1 });
    if (ccc.name.startsWith('ENTHDR')) {
      warnings.push({ code: 'enthdr-opaque', message: WARNING_ENTHDR_OPAQUE, offset: 1 });
    }

    if (cccCode === CCC_ENTDAA) {
      // ENTDAA gövdesi: 0xFD (repeated START + 0x7E/R) ile başlar, ardından
      // hedef tanıtımları gelir. 0xFD YOKSA da devam edilir — yakalama o
      // baytı kaçırmış olabilir, tanıtım blokları yine okunur.
      let bodyOffset = 2;
      if (byteAt(data, 2) === BROADCAST_READ_BYTE) {
        fields.push(addressField('broadcastRead', 'Repeated START · Broadcast Read', data, 2));
        bodyOffset = 3;
      }
      decodeDaaTargets(data, bodyOffset, fields, warnings);

      return buildSuccess(data, fields, warnings, parseOptions, {
        shape: 'entdaa',
        cccName: ccc.name,
      });
    }

    if (ccc.kind === 'direct') {
      if (data.length < 3) {
        return {
          success: false,
          error: {
            code: 'truncated-frame',
            message: ERROR_DIRECT_MISSING_TARGET,
            offset: 2,
            length: data.length,
          },
          consumedBytes: 0,
          recoverable: false,
        };
      }
      fields.push(addressField('targetAddress', 'Repeated START · Target Address', data, 2));
      appendCccPayload(data, 3, cccCode, fields);
      return buildSuccess(data, fields, warnings, parseOptions, { shape: 'ccc', cccName: ccc.name });
    }

    appendCccPayload(data, 2, cccCode, fields);
    return buildSuccess(data, fields, warnings, parseOptions, { shape: 'ccc', cccName: ccc.name });
  }

  // --- Private SDR / IBI ---------------------------------------------------
  const isIbi = requestedKind === FRAME_KIND_IBI;
  fields.push(
    addressField(
      isIbi ? 'ibiAddress' : 'targetAddress',
      isIbi ? 'IBI Requester Address' : 'Target Address',
      data,
      0,
    ),
  );

  if (isIbi) {
    if (data.length > 1) {
      const mdb = byteAt(data, 1);
      fields.push({
        id: 'mdb',
        name: 'Mandatory Data Byte',
        offset: 1,
        length: 1,
        rawBytes: data.slice(1, 2),
        rawValue: formatHexByte(mdb),
        valid: true,
        warnings: [],
      });
    }
    const payload = payloadField(data, 2, 'IBI Payload');
    if (payload !== undefined) fields.push(payload);
    return buildSuccess(data, fields, warnings, parseOptions, { shape: 'ibi' });
  }

  const payload = payloadField(data, 1, 'SDR Data');
  if (payload !== undefined) fields.push(payload);

  // `auto`da bir okuma transaction'ı IBI de olabilir — ayrım baytlarda YOK.
  if (requestedKind === FRAME_KIND_AUTO && i3cIsReadAddress(firstByte) && !i3cIsBroadcastAddress(firstByte)) {
    warnings.push({ code: 'ibi-ambiguous', message: WARNING_IBI_AMBIGUOUS, offset: 0 });
  }

  return buildSuccess(data, fields, warnings, parseOptions, { shape: 'private-sdr' });
}

/** Gövdesi TANINAN CCC'lerin payload'ını alan alan açar; ötekiler ham kalır. */
function appendCccPayload(
  data: Uint8Array,
  offset: number,
  cccCode: number,
  fields: ParsedField[],
): void {
  if (offset >= data.length) return;

  if (cccCode === CCC_ENEC || cccCode === CCC_DISEC || cccCode === CCC_ENEC_DIRECT || cccCode === CCC_DISEC_DIRECT) {
    fields.push(eventMaskField(data, offset));
    const rest = payloadField(data, offset + 1, 'Payload');
    if (rest !== undefined) fields.push(rest);
    return;
  }

  if (cccCode === CCC_GETPID && data.length - offset >= I3C_PID_BYTE_LENGTH) {
    fields.push(pidField(data, offset, '').field);
    return;
  }

  if (cccCode === CCC_GETBCR) {
    fields.push(bcrField(data, offset, ''));
    return;
  }

  if (cccCode === CCC_GETDCR) {
    fields.push(dcrField(data, offset, '').field);
    return;
  }

  if (cccCode === CCC_GETSTATUS && data.length - offset >= 2) {
    // `struct i3c_ccc_getstatus { __be16 status }` — big endian 16 bit.
    const status = (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
    const decoded = decodeStatus(status);
    fields.push({
      id: 'status',
      name: 'Status',
      offset,
      length: 2,
      rawBytes: data.slice(offset, offset + 2),
      rawValue: `0x${status.toString(HEX_RADIX).toUpperCase().padStart(4, '0')}`,
      physicalValue: `Pending IRQ ${String(decoded.pendingInterrupt)} · Activity mode ${String(decoded.activityMode)}${decoded.protocolError ? ' · Protocol error' : ''}`,
      valid: true,
      warnings: [],
    });
    return;
  }

  const payload = payloadField(data, offset, 'Payload');
  if (payload !== undefined) fields.push(payload);
}

function buildSuccess(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  parseOptions: I3cParseOptions,
  metadata: I3cFrameMetadata,
): ParseResult {
  const rawFrame = createRawFrame(data, {
    ...(parseOptions.timestamp === undefined ? {} : { timestamp: parseOptions.timestamp }),
    ...(parseOptions.direction === undefined ? {} : { direction: parseOptions.direction }),
    ...(parseOptions.channel === undefined ? {} : { channel: parseOptions.channel }),
    metadata,
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: true,
    errors: [],
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseI3c(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parseI3cFrame(data, options === undefined ? {} : { options });
}

export const i3cParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Private SDR trafiğinin ayırt edici imzası YOK (i2c gibi) — yalnız boş
   * olmadığına bakılır. CCC çerçeveleri `0xFC` ile başlar ama ön elemede bunu
   * ŞART koşmak private SDR'ı elerdi.
   */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: I3cParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.options !== undefined) options.options = context.options;
    return parseI3cFrame(data, options);
  },
};

/**
 * Örnek çerçeveler — `entdaa` spec'in "Bus discovery görünümü" örneğindeki İKİ
 * hedefi birebir taşır (`… Platformu.md`: PID 0x123456789ABC → DA 0x08,
 * PID 0x00A112334455 → DA 0x09). BCR/DCR spec'te verilmediği için seçildi ve
 * seçim testte gerekçesiyle sabitlendi.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'entdaa',
    name: 'protocol.i3c.example.entdaa.name',
    // 0xFC (7E+W), 0x07 (ENTDAA), 0xFD (7E+R),
    // hedef 1: PID 12 34 56 78 9A BC, BCR 0x06 (IBI req + IBI payload), DCR 0x00, DA 0x08<<1 = 0x10
    // hedef 2: PID 00 A1 12 33 44 55, BCR 0x00 (düz target),           DCR 0x00, DA 0x09<<1 = 0x12
    bytes: Uint8Array.from([
      0xfc, 0x07, 0xfd, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0x06, 0x00, 0x10, 0x00, 0xa1, 0x12,
      0x33, 0x44, 0x55, 0x00, 0x00, 0x12,
    ]),
    description: 'protocol.i3c.example.entdaa.description',
    expectedValid: true,
  },
  {
    id: 'broadcast-enec',
    name: 'protocol.i3c.example.broadcastEnec.name',
    // 0xFC, 0x00 (ENEC broadcast), 0x0B = SIR | MR | HJ.
    bytes: Uint8Array.from([0xfc, 0x00, 0x0b]),
    description: 'protocol.i3c.example.broadcastEnec.description',
    expectedValid: true,
  },
  {
    id: 'direct-getbcr',
    name: 'protocol.i3c.example.directGetbcr.name',
    // 0xFC, 0x8E (GETBCR direct), 0x11 (hedef 0x08 + R), 0x26 (BCR).
    bytes: Uint8Array.from([0xfc, 0x8e, 0x11, 0x26]),
    description: 'protocol.i3c.example.directGetbcr.description',
    expectedValid: true,
  },
  {
    id: 'private-sdr-write',
    name: 'protocol.i3c.example.privateSdrWrite.name',
    // 0x10 (hedef 0x08 + W), register 0x2F, iki bayt veri.
    bytes: Uint8Array.from([0x10, 0x2f, 0xa5, 0x5a]),
    description: 'protocol.i3c.example.privateSdrWrite.description',
    expectedValid: true,
  },
  {
    id: 'ibi',
    name: 'protocol.i3c.example.ibi.name',
    // 0x11 (hedef 0x08 + R), MDB 0x40, payload 0x01 0x23.
    // `auto`da private SDR read gibi görünür; `frameKind: ibi` seçilince MDB adlanır.
    bytes: Uint8Array.from([0x11, 0x40, 0x01, 0x23]),
    description: 'protocol.i3c.example.ibi.description',
    expectedValid: true,
  },
];

export const i3cPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: i3cParser,
  decodeOptions: DECODE_OPTIONS,
  documentation: {
    summary: 'protocol.i3c.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
