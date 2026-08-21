/**
 * PPP (RFC 1661/1662) — `protocol-core/framing/hdlcFraming.ts`nin (Faz 6)
 * ÜSTÜNDE ince bir `ProtocolPlugin` sarmalı. Çerçeveleme motoru zaten kesiyor
 * VE async kaçış çözüyor/kodluyor (SLIP'in AYNI jenerik motoru, yalnız XOR
 * tabanlı kural — bkz. `escapedDelimiterFraming.ts`) — burada YENİ bir
 * çerçeveleme algoritması YOK. Asıl yeni iş PPP'nin KENDİ alanları:
 * Address/Control (varsayılan biçim, yoksa ACFC varsayılır), Protocol field
 * demux (RFC 1661 §2 — LSB tek ise PFC'li tek bayt, çift ise iki bayt) ve
 * Protocol=LCP (0xC021) olduğunda LCP paket başlığı + bilinen seçenek
 * TLV'leri (RFC 1661 §5-6).
 *
 * Varsayılan çerçeveleme kabulü: Address=0xFF/Control=0x03, ACFC/PFC
 * negotiate EDİLMEDEN önceki durumdur (RFC 1662 §3) — bu motor müzakere
 * DURUMU TUTMAZ, her çerçeveyi kendi baytlarından (0xFF 0x03 var mı, ilk
 * Protocol baytının LSB'si tek mi) bağımsız çözer; "Negotiation Timeline"
 * (çok çerçeveli oturum takibi) bu yüzden bu dalgada YOK — Zigbee'nin BBMD/
 * Foreign Device tablo takibini "analyzer işi" sayıp ertelemesiyle aynı
 * disiplin (bkz. `src/protocols/index.ts` zigbee yorumu).
 *
 * FCS: LCP dalında (Length alanı sınırı bilindiği için) kalan baytlar ayrı
 * bir 'fcs' alanında GÖSTERİLİR ama DOĞRULANMAZ — motor var (`CRC16_X25`,
 * `crcCatalogue.ts`) ama bağımsız doğrulanmış bir PPP FCS fixture'ı elde
 * yok, uydurulmadı (bkz. CLAUDE.md fixture disiplini, XMODEM checksum'ın
 * aynı gerekçesi). Non-LCP protokoller (IPv4 vb.) için Information hiç
 * bölünmez — PPP'nin kendi başlığında bir uzunluk alanı yok, çerçeve sınırı
 * flag'ler arasıdır, FCS'i Information'dan ayırmanın güvenilir bir yolu yok.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';
import { HDLC_ESCAPE_RULE, HDLC_FLAG, encodeHdlcFlagFrame, hdlcFlagExtractor } from '@/protocol-core/framing/hdlcFraming';
import { mapFramingError } from './framingErrorMapping';

const PROTOCOL_ID = 'ppp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'PPP';

const TRANSLATION_KEY_PREFIX = 'protocol.ppp';

const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_NO_DELIMITER = `${TRANSLATION_KEY_PREFIX}.error.noDelimiter`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_NO_PROTOCOL_FIELD = `${TRANSLATION_KEY_PREFIX}.error.noProtocolField`;
const WARN_TRAILING_BYTES = `${TRANSLATION_KEY_PREFIX}.warning.trailingBytes`;
const WARN_UNKNOWN_LCP_OPTION = `${TRANSLATION_KEY_PREFIX}.warning.unknownLcpOption`;
const WARN_MALFORMED_LCP_OPTIONS = `${TRANSLATION_KEY_PREFIX}.warning.malformedLcpOptions`;

function toProtocolWarning(code: string): ProtocolWarning {
  return { code, message: code };
}

function hexByte(byte: number): string {
  return `0x${byte.toString(16).toUpperCase().padStart(2, '0')}`;
}

function hexString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

const PPP_ADDRESS = 0xff;
const PPP_CONTROL = 0x03;
const LCP_PROTOCOL_NUMBER = 0xc021;

/** RFC 1661 §5 — yalnız bu dalganın adlandırdığı kod kümesi (12+ RFC 1570 eki, uydurulmadı). */
const LCP_CODE_NAMES: Readonly<Record<number, string>> = {
  1: 'Configure-Request',
  2: 'Configure-Ack',
  3: 'Configure-Nak',
  4: 'Configure-Reject',
  5: 'Terminate-Request',
  6: 'Terminate-Ack',
  7: 'Code-Reject',
  8: 'Protocol-Reject',
  9: 'Echo-Request',
  10: 'Echo-Reply',
  11: 'Discard-Request',
};

/** RFC 1661 §6 — Configure-* paketlerinin taşıdığı seçenek TLV'leri, dar/bilinen alt küme. */
const LCP_OPTION_NAMES: Readonly<Record<number, string>> = {
  1: 'Maximum-Receive-Unit',
  2: 'Async-Control-Character-Map',
  3: 'Authentication-Protocol',
  5: 'Magic-Number',
  7: 'Protocol-Field-Compression',
  8: 'Address-and-Control-Field-Compression',
};

/** RFC 1661/1662 — bu motorun adlandırdığı dar protokol numarası kümesi (IANA PPP DLL Protocol Numbers). */
const PROTOCOL_FIELD_NAMES: Readonly<Record<number, string>> = {
  0x0021: 'IPv4',
  0x8021: 'IPCP (IP Control Protocol)',
  0xc021: 'LCP (Link Control Protocol)',
  0xc023: 'PAP (Password Authentication Protocol)',
  0xc223: 'CHAP (Challenge Handshake Authentication Protocol)',
};

function describeProtocolNumber(value: number): string {
  return PROTOCOL_FIELD_NAMES[value] ?? `Unknown (${hexByte((value >> 8) & 0xff)} ${hexByte(value & 0xff)})`;
}

interface DecodedPosition {
  readonly wireOffset: number;
  readonly wireLength: number;
}

/**
 * bkz. kiss.ts aynı adlı fonksiyon. `HDLC_ESCAPE_RULE`in ters yönü SLIP'ten
 * FARKLI: `substitutions` haritası yok, tersi XOR'un kendisi (`escaped XOR
 * xorMask === original`, bkz. `findEscapeEvents`) — mantık aynı, tersleme
 * kuralı ayrı.
 */
function mapDecodedPositions(wireContent: Uint8Array, escapeByte: number): DecodedPosition[] {
  const positions: DecodedPosition[] = [];
  let i = 0;
  while (i < wireContent.length) {
    if (wireContent[i] === escapeByte && i + 1 < wireContent.length) {
      positions.push({ wireOffset: i, wireLength: 2 });
      i += 2;
    } else {
      positions.push({ wireOffset: i, wireLength: 1 });
      i += 1;
    }
  }
  return positions;
}

/** Çözülmüş bayt aralığı `[startIndex, endIndex)`i wireContent-GÖRELİ konuma çevirir. */
function decodedRangeToWire(
  positions: DecodedPosition[],
  startIndex: number,
  endIndex: number,
): { relativeOffset: number; length: number } {
  const first = positions[startIndex];
  if (first === undefined) return { relativeOffset: 0, length: 0 };
  const last = positions[endIndex - 1];
  if (last === undefined) return { relativeOffset: first.wireOffset, length: 0 };
  return { relativeOffset: first.wireOffset, length: last.wireOffset + last.wireLength - first.wireOffset };
}

interface FieldContext {
  readonly wireContent: Uint8Array;
  readonly positions: DecodedPosition[];
  readonly searchStart: number;
}

/**
 * PPP'nin Address/Control/Protocol/LCP-Code/Length/seçenek gibi BİRDEN ÇOK
 * çözülmüş baytı kapsayan alanları olduğu için `findEscapeEvents`in tek-olay
 * işaretlemesi yetmez — bu, herhangi bir çözülmüş bayt ARALIĞI için doğru
 * tel offset/uzunluğunu hesaplayıp `ParsedField` üreten TEK ortak yol.
 */
function buildField(
  ctx: FieldContext,
  id: string,
  name: string,
  startIndex: number,
  endIndex: number,
  rawValue: ParsedField['rawValue'],
  extra: { physicalValue?: ParsedField['physicalValue']; warnings?: string[]; valid?: boolean } = {},
): ParsedField {
  const range = decodedRangeToWire(ctx.positions, startIndex, endIndex);
  const field: ParsedField = {
    id,
    name,
    offset: ctx.searchStart + range.relativeOffset,
    length: range.length,
    rawBytes: ctx.wireContent.slice(range.relativeOffset, range.relativeOffset + range.length),
    rawValue,
    valid: extra.valid ?? true,
    warnings: extra.warnings ?? [],
  };
  if (extra.physicalValue !== undefined) field.physicalValue = extra.physicalValue;
  return field;
}

/**
 * `HDLC_ESCAPE_RULE`in ters yönü SLIP'ten farklı: `substitutions` haritası
 * YOK, tersi XOR'un kendisi (`escaped XOR xorMask === original`) — XOR kendi
 * tersidir, Map aramasına gerek yok, her bayt için TOTAL bir işlem (SLIP'in
 * tersine, hiçbir "tanımsız ikame" durumu yok).
 */
function findEscapeEvents(wireContent: Uint8Array, wireOffset: number): ParsedField[] {
  const events: ParsedField[] = [];
  const escapeByte = HDLC_ESCAPE_RULE.escapeByte;
  const xorMask = HDLC_ESCAPE_RULE.xorMask ?? 0;
  let i = 0;
  let index = 0;
  while (i < wireContent.length) {
    const current = wireContent[i];
    if (current === escapeByte) {
      const next = wireContent[i + 1];
      if (next !== undefined) {
        const decoded = next ^ xorMask;
        events.push({
          id: `escape-event-${index}`,
          name: 'Escape Sequence',
          offset: wireOffset + i,
          length: 2,
          rawBytes: wireContent.slice(i, i + 2),
          rawValue: `${hexByte(escapeByte)} ${hexByte(next)}`,
          physicalValue: hexByte(decoded),
          valid: true,
          warnings: [],
        });
        index += 1;
        i += 2;
        continue;
      }
    }
    i += 1;
  }
  return events;
}

interface LcpHeader {
  readonly code: number;
  readonly identifier: number;
  readonly length: number;
}

function tryParseLcpHeader(information: Uint8Array): LcpHeader | undefined {
  if (information.length < 4) return undefined;
  const code = information[0];
  const identifier = information[1];
  const lengthHigh = information[2];
  const lengthLow = information[3];
  if (code === undefined || identifier === undefined || lengthHigh === undefined || lengthLow === undefined) {
    return undefined;
  }
  const length = (lengthHigh << 8) | lengthLow;
  if (length < 4 || length > information.length) return undefined;
  return { code, identifier, length };
}

function describeLcpOptionData(type: number, data: Uint8Array): string {
  switch (type) {
    case 1: // Maximum-Receive-Unit
      return data.length === 2 ? `MRU = ${((data[0] ?? 0) << 8) | (data[1] ?? 0)} bytes` : hexString(data);
    case 5: // Magic-Number
      return data.length === 4 ? `Magic Number = ${hexString(data)}` : hexString(data);
    case 7: // Protocol-Field-Compression
    case 8: // Address-and-Control-Field-Compression
      return '(no data — flag option)';
    default:
      return data.length === 0 ? '(no data)' : hexString(data);
  }
}

/** RFC 1661 §6 — Type(1)+Length(1, TOPLAM)+Data(Length-2) zinciri, BACnet/Matter TLV emsali dar tarama. */
function decodeLcpOptions(
  ctx: FieldContext,
  lcpData: Uint8Array,
  decodedBase: number,
): { fields: ParsedField[]; warnings: string[] } {
  const fields: ParsedField[] = [];
  const warnings: string[] = [];
  let i = 0;
  let index = 0;
  while (i < lcpData.length) {
    const type = lcpData[i];
    const length = lcpData[i + 1];
    if (type === undefined || length === undefined || length < 2 || i + length > lcpData.length) {
      fields.push(
        buildField(
          ctx,
          `lcp-option-${index}-malformed`,
          'LCP Options (malformed remainder)',
          decodedBase + i,
          decodedBase + lcpData.length,
          hexString(lcpData.slice(i)),
          { valid: false, warnings: [WARN_MALFORMED_LCP_OPTIONS] },
        ),
      );
      warnings.push(WARN_MALFORMED_LCP_OPTIONS);
      return { fields, warnings };
    }

    const optionData = lcpData.slice(i + 2, i + length);
    const name = LCP_OPTION_NAMES[type];
    fields.push(
      buildField(
        ctx,
        `lcp-option-${index}`,
        `LCP Option: ${name ?? `Unknown (${type})`}`,
        decodedBase + i,
        decodedBase + i + length,
        hexString(lcpData.slice(i, i + length)),
        { physicalValue: describeLcpOptionData(type, optionData), warnings: name === undefined ? [WARN_UNKNOWN_LCP_OPTION] : [] },
      ),
    );
    if (name === undefined) warnings.push(WARN_UNKNOWN_LCP_OPTION);

    i += length;
    index += 1;
  }
  return { fields, warnings };
}

function parsePppFrame(data: Uint8Array, context?: ParseContext): ParseResult {
  if (context?.signal?.aborted === true) {
    return { success: false, error: { code: 'parser-timeout', message: ERROR_ABORTED }, consumedBytes: 0, recoverable: false };
  }
  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY_FRAME, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = context?.maxFrameLength ?? data.length;
  const result = hdlcFlagExtractor.extract(data, { maxFrameLength });

  if (result.status === 'incomplete') {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_NO_DELIMITER, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }
  if (result.status === 'error') {
    const mapped = mapFramingError(result.error);
    return {
      success: false,
      error: { code: mapped.code, message: mapped.message, offset: mapped.offset },
      consumedBytes: result.consumedBytes,
      recoverable: result.recoverable,
    };
  }

  // result.status === 'complete' — motor boş çerçeveyi (art arda iki flag)
  // zaten 'error' olarak reddediyor (escapedDelimiterFraming.ts:65-75), bu
  // yüzden decoded.length burada her zaman >= 1.
  const searchStart = data[0] === HDLC_FLAG ? 1 : 0;
  const delimiterIndex = result.consumedBytes - 1;
  const wireContent = data.subarray(searchStart, delimiterIndex);
  const decoded = result.frame;
  const positions = mapDecodedPositions(wireContent, HDLC_ESCAPE_RULE.escapeByte);
  const ctx: FieldContext = { wireContent, positions, searchStart };

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];

  if (searchStart === 1) {
    fields.push({
      id: 'leading-flag',
      name: 'Leading Flag (optional sync)',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: 'FLAG',
      valid: true,
      warnings: [],
    });
  }

  fields.push(...findEscapeEvents(wireContent, searchStart));

  // Address/Control — varsayılan biçimde SABİT 0xFF/0x03 (RFC 1662 §3);
  // yoklarsa ACFC (Address-and-Control-Field-Compression) varsayılır. Bu bir
  // müzakere durumu OKUMASI değil, içerikten çıkarım (DALI'nin 1/2/3-bayt
  // biçim algılamasıyla aynı disiplin, bkz. index.ts dali yorumu).
  const hasAddressControl = decoded.length >= 2 && decoded[0] === PPP_ADDRESS && decoded[1] === PPP_CONTROL;
  const cursorAfterAddressControl = hasAddressControl ? 2 : 0;
  if (hasAddressControl) {
    fields.push(buildField(ctx, 'address', 'Address', 0, 1, hexByte(PPP_ADDRESS), { physicalValue: 'All-Stations (0xFF)' }));
    fields.push(
      buildField(ctx, 'control', 'Control', 1, 2, hexByte(PPP_CONTROL), {
        physicalValue: 'UI — Unnumbered Information (0x03)',
      }),
    );
  }

  const firstProtocolByte = decoded[cursorAfterAddressControl];
  if (firstProtocolByte === undefined) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_NO_PROTOCOL_FIELD, offset: searchStart + cursorAfterAddressControl },
      consumedBytes: result.consumedBytes,
      recoverable: true,
    };
  }
  // RFC 1661 §2 — PFC: LSB tek ise Protocol field TEK bayt, çift ise İKİ bayt.
  const isCompressed = (firstProtocolByte & 0x01) === 1;
  const protocolLength = isCompressed ? 1 : 2;
  if (decoded.length < cursorAfterAddressControl + protocolLength) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_NO_PROTOCOL_FIELD, offset: searchStart + cursorAfterAddressControl },
      consumedBytes: result.consumedBytes,
      recoverable: true,
    };
  }
  const secondProtocolByte = decoded[cursorAfterAddressControl + 1];
  const protocolNumber = isCompressed ? firstProtocolByte : (firstProtocolByte << 8) | (secondProtocolByte ?? 0);
  fields.push(
    buildField(
      ctx,
      'protocol',
      'Protocol',
      cursorAfterAddressControl,
      cursorAfterAddressControl + protocolLength,
      isCompressed ? hexByte(protocolNumber) : `${hexByte(protocolNumber >> 8)} ${hexByte(protocolNumber & 0xff)}`,
      { physicalValue: describeProtocolNumber(protocolNumber) },
    ),
  );
  const cursor = cursorAfterAddressControl + protocolLength;

  const information = decoded.slice(cursor);
  const lcpHeader = protocolNumber === LCP_PROTOCOL_NUMBER ? tryParseLcpHeader(information) : undefined;

  if (lcpHeader !== undefined) {
    fields.push(
      buildField(ctx, 'lcp-code', 'LCP Code', cursor, cursor + 1, lcpHeader.code, {
        physicalValue: LCP_CODE_NAMES[lcpHeader.code] ?? `Unknown (${lcpHeader.code})`,
      }),
    );
    fields.push(buildField(ctx, 'lcp-identifier', 'LCP Identifier', cursor + 1, cursor + 2, lcpHeader.identifier));
    fields.push(buildField(ctx, 'lcp-length', 'LCP Length', cursor + 2, cursor + 4, lcpHeader.length));

    const lcpDataStart = cursor + 4;
    const lcpEnd = cursor + lcpHeader.length;
    const lcpData = decoded.slice(lcpDataStart, lcpEnd);

    if (lcpHeader.code === 1 || lcpHeader.code === 2 || lcpHeader.code === 3 || lcpHeader.code === 4) {
      // Configure-Request/Ack/Nak/Reject — Data seçenek TLV zinciri.
      const options = decodeLcpOptions(ctx, lcpData, lcpDataStart);
      fields.push(...options.fields);
      for (const code of options.warnings) warnings.push(toProtocolWarning(code));
    } else if (lcpData.length > 0) {
      fields.push(
        buildField(ctx, 'lcp-data', 'LCP Data', lcpDataStart, lcpEnd, hexString(lcpData), {
          physicalValue:
            lcpHeader.code === 8 && lcpData.length >= 2
              ? `Rejected Protocol = ${describeProtocolNumber(((lcpData[0] ?? 0) << 8) | (lcpData[1] ?? 0))}`
              : '(raw — not decoded further)',
        }),
      );
    }

    // LCP'nin KENDİ Length'i bittikten sonra kalan bayt — varsayılan
    // çerçevelemede FCS-16 (RFC 1662 §3), DOĞRULANMAZ (bkz. dosya başı).
    if (lcpEnd < decoded.length) {
      fields.push(
        buildField(ctx, 'fcs', 'FCS (unvalidated)', lcpEnd, decoded.length, hexString(decoded.slice(lcpEnd)), {
          physicalValue: 'FCS-16 per RFC 1662 default framing — not validated by this engine',
        }),
      );
    }
  } else if (information.length > 0) {
    fields.push(
      buildField(ctx, 'information', 'Information', cursor, decoded.length, hexString(information), {
        physicalValue: '(raw — not decoded by this engine)',
      }),
    );
  }

  if (result.consumedBytes < data.length) {
    const trailingOffset = result.consumedBytes;
    fields.push({
      id: 'trailing-bytes',
      name: 'Trailing Bytes (after frame)',
      offset: trailingOffset,
      length: data.length - trailingOffset,
      rawBytes: data.slice(trailingOffset),
      rawValue: hexString(data.slice(trailingOffset)),
      valid: true,
      warnings: [WARN_TRAILING_BYTES],
    });
    warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
  }

  const rawFrame = createRawFrame(data, {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
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

export const pppParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length > 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parsePppFrame(data, context);
  },
};

// ── Örnekler ───────────────────────────────────────────────────────────

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'lcp-configure-request',
    // LCP Configure-Request, tek seçenek: MRU=1500 (Ethernet MTU'sunun
    // standart değeri). Address/Control standart (0xFF/0x03), kaçış yok.
    name: `${TRANSLATION_KEY_PREFIX}.example.lcpConfigureRequest.name`,
    bytes: encodeHdlcFlagFrame(
      Uint8Array.from([0xff, 0x03, 0xc0, 0x21, 0x01, 0x01, 0x00, 0x08, 0x01, 0x04, 0x05, 0xdc]),
    ),
    description: `${TRANSLATION_KEY_PREFIX}.example.lcpConfigureRequest.description`,
    expectedValid: true,
  },
  {
    id: 'escaped-information',
    // hdlcFraming.test.ts:12'nin DOĞRULANMIŞ PPP fixture'ı (01 7E 02), IPv4
    // Information alanı olarak — standart Address/Control üstünde async
    // kaçışı gösterir.
    name: `${TRANSLATION_KEY_PREFIX}.example.escapedInformation.name`,
    bytes: encodeHdlcFlagFrame(Uint8Array.from([0xff, 0x03, 0x00, 0x21, 0x01, 0x7e, 0x02])),
    description: `${TRANSLATION_KEY_PREFIX}.example.escapedInformation.description`,
    expectedValid: true,
  },
  {
    id: 'compressed-fields',
    // ACFC (Address/Control yok) + PFC (Protocol tek bayt 0x21 = IPv4'ün
    // sıkıştırılmış hâli) — RFC 1661 §7.6/§2 ikisi birden.
    name: `${TRANSLATION_KEY_PREFIX}.example.compressedFields.name`,
    bytes: encodeHdlcFlagFrame(Uint8Array.from([0x21, 0x45, 0x00, 0x00, 0x14])),
    description: `${TRANSLATION_KEY_PREFIX}.example.compressedFields.description`,
    expectedValid: true,
  },
];

export const pppPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'interfaces-framing',
  parser: pppParser,
  encoder: { encode: encodeHdlcFlagFrame },
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
    references: [
      { title: 'RFC 1661 — The Point-to-Point Protocol (PPP)', url: 'https://www.rfc-editor.org/rfc/rfc1661' },
      { title: 'RFC 1662 — PPP in HDLC-like Framing', url: 'https://www.rfc-editor.org/rfc/rfc1662' },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
