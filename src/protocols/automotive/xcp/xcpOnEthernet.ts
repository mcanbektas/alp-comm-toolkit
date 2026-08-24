/**
 * XCP on Ethernet — ASAM XCP Part 3 (Ethernet taşıma katmanı: UDP veya TCP)
 * üzerinde CTO/DTO paketleri.
 *
 * Faz 10, dalga 14c (`docs/brief-faz10-dalga14c.md`). Spec `:363`: "XCP base
 * protokolü aynı kalır, transport: Ethernet → IP → UDP veya TCP → XCP."
 *
 * ── GİRDİ SÖZLEŞMESİ ─────────────────────────────────────────────────────────
 * Girdi XCP-on-Ethernet TAŞIMA BİRİMİDİR (taşıma başlığı + XCP paketi),
 * MAC/IP/UDP/TCP çerçevesinin TAMAMI DEĞİL — `ipv4.ts:1-11`in üst katmanı
 * ÇÖZMEYİP adlandırıp "şu sayfada çöz" uyarısı basma deseninin birebir emsali
 * (`ethernetFrame.ts`in EtherType deseni). MAC/IP/UDP/TCP kayıtlarının hepsi
 * zaten `ready` ve kendi sayfalarında çözülüyor — motorlar zincir KURMAZ
 * (12f WebSocket el sıkışması kararı).
 *
 * TCP stream reassembly (spec `:373`) BU KAYDIN İŞİ DEĞİLDİR — depo "girdi tek
 * mesaj" çizgisinde durur (12h FTP/Telnet kararı). Eksik veri
 * `consumedBytes: 0` + `recoverable: true` ile bildirilir (`types.ts:148`).
 *
 * ── UDP/TCP AYRIMI İÇİN KANAL AÇILMIYOR ─────────────────────────────────────
 * Taşıma başlığı iki taşıyıcıda da AYNIDIR; ayrım pakete yazılmaz ve alan
 * tablosunu değiştirmez (12f WebSocket MASK-biti kararının aynısı). Taşıyıcı
 * bilgisi istenirse `RawFrame.channel` zaten var.
 *
 * Açılan TEK kanal 14b'nin `role`/`byteOrder`ıdır — XCP paketinin KENDİSİNE
 * ait, taşıyıcıdan bağımsız bir belirsizlik (`xcpPacket.ts` dosya başı
 * DÜZELTME 1/2). `xcpOnCan.ts`ten PAYLAŞILIR (aynı dizi referansı, İKİNCİ KEZ
 * YAZILMAZ), aynı çeviri anahtarları (`protocol.xcp.option.*`).
 *
 * ── KAYNAK UYARISI — TAŞIMA BAŞLIĞI, İKİ KAYNAK ÇELİŞİYOR (2026-08-24) ─────
 * Spec taşıma başlığının alan ADLARINI bile vermiyor, yalnız "XCP Transport
 * Header" diyor (brief). İki bağımsız açık kaynak koddan doğrulandı:
 *
 *   1. Scapy (GPL-2.0-only, secdev/scapy) `contrib/automotive/xcp/xcp.py`:
 *      https://github.com/secdev/scapy/blob/master/scapy/contrib/automotive/xcp/xcp.py
 *      `class XCPOnUDP(UDP): fields_desc = UDP.fields_desc + [
 *      ShortField("length", None), ShortField("ctr", 0)]` ve `post_build`:
 *      `pkt = pkt[:8] + struct.pack("!H", tmp_len) + pkt[10:]` — `"!H"` =
 *      network byte order = BIG-ENDIAN.
 *
 *   2. pyxcp (LGPL, christoph2/pyxcp) `pyxcp/transport/eth.py`:
 *      https://github.com/christoph2/pyxcp/blob/master/pyxcp/transport/eth.py
 *      `class Eth(BaseTransport): HEADER = struct.Struct("<HH")`, eşlik eden
 *      `XcpFramingConfig(transport_layer_type=XcpTransportLayerType.ETH,
 *      header_len=2, header_ctr=2)` — `"<HH"` = LITTLE-ENDIAN.
 *
 * İKİSİ DE başlığın 4 bayt olduğunda, LEN(2B)+CTR(2B) SIRASINDA, her alanın
 * GENİŞLİĞİNDE (2B) ve KONUMUNDA (XCP paketinden hemen önce) ÖRTÜŞÜYOR — bu
 * yüzden alanlar ADLANDIRILDI ve konumlandırıldı. AMA bayt SIRASINDA
 * (endianness) AÇIKÇA ÇELİŞİYOR: Scapy'nin hem alan tanımı (ShortField'ın
 * kendi `Field` temel sınıfı network byte order kullanır) hem de post_build'in
 * LİTERAL `"!H"` paketleme kodu big-endian derken, pyxcp'nin `Struct("<HH")`
 * tanımı little-endian diyor. Bu iki kaynağın aynı sayıda örtüşmediği durumda
 * brief `:52-54` "alan ADLANDIRILMAZ, ham kalır" diyor — bu yüzden `length`/
 * `counter` alanları yalnız HAM BAYT (`rawBytes`) olarak gösterilir, `rawValue`
 * BİLEREK YOK: hiçbir sayısal yorum İDDİA EDİLMEZ (DecodePanel `rawValue`
 * `undefined`i "—" ile gösterir, `DecodePanel.tsx:182`).
 *
 * Not: icanhack.nl'nin genel XCP tanıtımı
 * (https://icanhack.nl/knowledge-base/diagnostics/xcp/) PROTOKOL KATMANININ
 * kendi, opsiyonel, 1 baytlık ve yalnız DAQ DTO'larında bulunan bir CTR
 * alanını anlatır ("Used to detect lost DAQ DTOs") — BU dosyanın taşıma
 * katmanı CTR'ı (2 bayt, HER çerçevede zorunlu, LEN'in hemen ardından) ile
 * KARIŞTIRILMAMALI; ikisi ayrı kavram, üçüncü kaynak bu çelişkiyi çözmedi.
 *
 * ── LEN ALANI ÇERÇEVE SINIRI İÇİN KULLANILMIYOR ─────────────────────────────
 * Yukarıdaki çelişki nedeniyle LEN sayısal olarak hiç OKUNMUYOR. Çerçeve
 * sınırı için girdi sözleşmesine güvenilir: girdi zaten TEK bir taşıma
 * birimidir (dosya başı), XCP paketi başlıktan SONRAKİ TÜM baytlardır
 * (`data.length - 4`) — `xcpOnCan.ts`in DLC'yi `availableAfterHeader`la
 * sınırlamasının aksine, burada LEN'e hiç ihtiyaç yok.
 *
 * ── XCP PAKET ÇEKİRDEĞİ: xcpPacket.ts'in İKİNCİ TÜKETİCİSİ ─────────────────
 * `decodeXcpPacket` `xcpOnCan.ts`teki BİREBİR imzayla çağrılır — yalnız
 * paketin başlangıç ofseti (CAN'de `CAN_HEADER_LENGTH`=8, burada
 * `TRANSPORT_HEADER_LENGTH`=4) değişir. Çekirdek taşıyıcı bilmez
 * (`xcpPacket.ts` dosya başı: "Girmez: CAN kimliği, Ethernet LEN/CTR başlığı").
 */

import { decodeXcpPacket } from './xcpPacket';
import type { XcpRole } from './xcpPacket';
import {
  BYTE_ORDER_BIG,
  BYTE_ORDER_LITTLE,
  DECODE_OPTIONS,
  OPTION_BYTE_ORDER,
  OPTION_ROLE,
  ROLE_COMMAND,
  ROLE_RESPONSE,
} from './xcpOnCan';
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

const PROTOCOL_ID = 'xcp-on-ethernet';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'XCP on Ethernet';

/** Taşıma başlığı: LEN(2B) + CTR(2B) — dosya başı kaynak uyarısı. */
const TRANSPORT_HEADER_LENGTH = 4;
const LENGTH_FIELD_OFFSET = 0;
const LENGTH_FIELD_WIDTH = 2;
const COUNTER_FIELD_OFFSET = 2;
const COUNTER_FIELD_WIDTH = 2;

const ERROR_FRAME_TOO_SHORT = 'protocol.xcpEth.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.xcpEth.error.frameTooLong';
const ERROR_ABORTED = 'protocol.xcpEth.error.aborted';
const ERROR_EMPTY_PACKET = 'protocol.xcpEth.error.emptyPacket';

/** Taşıma başlığının LEN/CTR alanları — dosya başı, iki kaynak çelişiyor. */
const WARN_HEADER_BYTE_ORDER_UNRESOLVED = 'protocol.xcpEth.warning.headerByteOrderUnresolved';

const SUMMARY_PREFIX = 'protocol.xcpEth.summary.';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

export type XcpOnEthernetFrameMetadata = {
  role: XcpRole;
  pid: number;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface XcpOnEthernetParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  role: XcpRole;
  byteOrder: typeof BYTE_ORDER_LITTLE | typeof BYTE_ORDER_BIG;
}

function resolveParseOptions(context: ParseContext | undefined): XcpOnEthernetParseOptions {
  const rawRole = context?.options?.[OPTION_ROLE];
  const role: XcpRole = rawRole === ROLE_RESPONSE ? ROLE_RESPONSE : ROLE_COMMAND;
  const rawByteOrder = context?.options?.[OPTION_BYTE_ORDER];
  const byteOrder = rawByteOrder === BYTE_ORDER_BIG ? BYTE_ORDER_BIG : BYTE_ORDER_LITTLE;
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    role,
    byteOrder,
  };
}

function parseXcpOnEthernetFrame(data: Uint8Array, options: XcpOnEthernetParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < TRANSPORT_HEADER_LENGTH) {
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

  // Ethernet'in CAN gibi doğal bir üst sınırı yoktur (ipv4.ts emsali):
  // yalnız çağıran açıkça bir sınır verdiyse denetlenir.
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

  // LEN/CTR: konum+genişlik iki kaynakta da örtüşüyor, bayt SIRASI çelişiyor
  // (dosya başı) — yalnız ham bayt gösterilir, rawValue BİLEREK yok.
  fields.push({
    id: 'length',
    name: 'Length',
    offset: LENGTH_FIELD_OFFSET,
    length: LENGTH_FIELD_WIDTH,
    rawBytes: data.slice(LENGTH_FIELD_OFFSET, LENGTH_FIELD_OFFSET + LENGTH_FIELD_WIDTH),
    valid: true,
    warnings: [WARN_HEADER_BYTE_ORDER_UNRESOLVED],
  });
  fields.push({
    id: 'counter',
    name: 'Counter',
    offset: COUNTER_FIELD_OFFSET,
    length: COUNTER_FIELD_WIDTH,
    rawBytes: data.slice(COUNTER_FIELD_OFFSET, COUNTER_FIELD_OFFSET + COUNTER_FIELD_WIDTH),
    valid: true,
    warnings: [WARN_HEADER_BYTE_ORDER_UNRESOLVED],
  });
  warnings.push(toProtocolWarning(WARN_HEADER_BYTE_ORDER_UNRESOLVED));

  let pid = -1;
  if (data.length === TRANSPORT_HEADER_LENGTH) {
    // Yalnız başlık var, XCP paketi yok — PID baytı bile okunamaz.
    errors.push({
      code: 'truncated-frame',
      message: ERROR_EMPTY_PACKET,
      offset: TRANSPORT_HEADER_LENGTH,
      length: 0,
    });
  } else {
    pid = byteAt(data, TRANSPORT_HEADER_LENGTH);
    decodeXcpPacket(
      data,
      TRANSPORT_HEADER_LENGTH,
      data.length,
      options.role,
      options.byteOrder,
      fields,
      warnings,
      errors,
      '',
    );
  }

  const summaryParams: Record<string, string> = {
    pid: pid >= 0 ? `0x${pid.toString(16).toUpperCase().padStart(2, '0')}` : '—',
  };

  const metadata: XcpOnEthernetFrameMetadata = {
    role: options.role,
    pid,
    summaryKey: `${SUMMARY_PREFIX}${options.role}`,
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

export function parseXcpOnEthernet(data: Uint8Array): ParseResult {
  return parseXcpOnEthernetFrame(data, { role: ROLE_COMMAND, byteOrder: BYTE_ORDER_LITTLE });
}

export const xcpOnEthernetParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme: yalnız asgari uzunluk (başlık + en az 1 PID baytı).
   * `xcpOnCan.ts`in aynı gerekçesi: taşıma başlığı XCP'ye özgü sabit bir
   * imza taşımaz (LEN/CTR'ın kendisi bile belirsiz, dosya başı), ID/imza
   * bazlı ek eleme YAPILAMAZ.
   */
  canParse(data: Uint8Array): boolean {
    return data.length > TRANSPORT_HEADER_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseXcpOnEthernetFrame(data, resolveParseOptions(context));
  },
};

/**
 * Örnek çerçeveler. Taşıma başlığı baytları bilerek `0x00 0x00 0x00 0x00`:
 * dosya başındaki çelişki nedeniyle herhangi bir sayısal yorum İDDİA
 * EDİLMEDİĞİ için örnek baytların kendisi de nötr tutuldu. XCP paketi
 * kısmı `xcpOnCan.ts`in örnekleriyle BİREBİR aynı bayt dizileri — iki
 * kayıt arasında karşılaştırma yapmayı kolaylaştırır (aynı çekirdek).
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'connect-command-normal',
    name: 'protocol.xcpEth.example.connectCommandNormal.name',
    // Başlık 00 00 00 00 + PID 0xFF=CONNECT, connection_mode 0x00=NORMAL.
    bytes: Uint8Array.from([0x00, 0x00, 0x00, 0x00, 0xff, 0x00]),
    description: 'protocol.xcpEth.example.connectCommandNormal.description',
    expectedValid: true,
  },
  {
    id: 'connect-positive-response',
    name: 'protocol.xcpEth.example.connectPositiveResponse.name',
    // Başlık 00 00 00 00 + PID 0xFF=RES; resource/comm-mode/max-cto/max-dto/
    // sürüm alanları — `decodeOptions.role=response` ile açılmalı.
    bytes: Uint8Array.from([0x00, 0x00, 0x00, 0x00, 0xff, 0x05, 0x00, 0x08, 0x08, 0x00, 0x01, 0x01]),
    description: 'protocol.xcpEth.example.connectPositiveResponse.description',
    expectedValid: true,
  },
  {
    id: 'get-status-command',
    name: 'protocol.xcpEth.example.getStatusCommand.name',
    // Başlık 00 00 00 00 + PID 0xFD=GET_STATUS, parametresiz.
    bytes: Uint8Array.from([0x00, 0x00, 0x00, 0x00, 0xfd]),
    description: 'protocol.xcpEth.example.getStatusCommand.description',
    expectedValid: true,
  },
  {
    id: 'set-mta-command',
    name: 'protocol.xcpEth.example.setMtaCommand.name',
    // Başlık 00 00 00 00 + PID 0xF6=SET_MTA, reserved 00 00, address_ext 00,
    // address 0x00001000 (LE: 00 10 00 00) — byteOrder=big-endian ile FARKLI
    // bir adrese çözülür.
    bytes: Uint8Array.from([0x00, 0x00, 0x00, 0x00, 0xf6, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00]),
    description: 'protocol.xcpEth.example.setMtaCommand.description',
    expectedValid: true,
  },
  {
    id: 'error-response-cmd-unknown',
    name: 'protocol.xcpEth.example.errorResponseCmdUnknown.name',
    // Başlık 00 00 00 00 + PID 0xFE=ERR, error_code 0x20=ERR_CMD_UNKNOWN —
    // `decodeOptions.role=response` ile açılmalı.
    bytes: Uint8Array.from([0x00, 0x00, 0x00, 0x00, 0xfe, 0x20]),
    description: 'protocol.xcpEth.example.errorResponseCmdUnknown.description',
    expectedValid: true,
  },
  {
    id: 'empty-packet-header-only',
    name: 'protocol.xcpEth.example.emptyPacketHeaderOnly.name',
    // Yalnız 4 baytlık taşıma başlığı, XCP paketi YOK — truncated-frame hatası.
    bytes: Uint8Array.from([0x00, 0x02, 0x00, 0x00]),
    description: 'protocol.xcpEth.example.emptyPacketHeaderOnly.description',
    expectedValid: false,
  },
];

export const xcpOnEthernetPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: xcpOnEthernetParser,
  documentation: {
    summary: 'protocol.xcpEth.documentation.summary',
    layer: 'application',
    references: [
      {
        title: 'Scapy — contrib/automotive/xcp (GPL-2.0-only)',
        url: 'https://github.com/secdev/scapy/blob/master/scapy/contrib/automotive/xcp/xcp.py',
      },
      {
        title: 'pyxcp — transport/eth.py (LGPL)',
        url: 'https://github.com/christoph2/pyxcp/blob/master/pyxcp/transport/eth.py',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  // xcpOnCan.ts'ten PAYLAŞILIR — aynı dizi referansı, İKİNCİ KEZ YAZILMADI.
  decodeOptions: DECODE_OPTIONS,
};
