/**
 * Telnet (RFC 854) — TCP üstünde çift yönlü, bayt odaklı terminal akışı. Düz
 * metin ile protokol-kontrol komutları AYNI stream'de iç içe taşınır; ayırıcı
 * özel bayt `IAC = 0xFF` (Interpret As Command).
 *
 * ── GİRDİ: YAPIŞTIRILAN TCP PAYLOAD'U (brief açık soru 4) ────────────────────
 * Telnet'in kendi başına mesaj sınırı YOK — `ftp.ts`nin "birden çok satır"
 * kararının bir adım ötesi: burada satır bile yok, düz metin ve IAC
 * komutları rastgele noktalarda kesişebilir. Bu dosya girdiyi "yapıştırılan
 * TCP payload'u" varsayar (brief madde 4) ve baştan sona TEK GEÇİŞTE, metin
 * koşularını ve IAC dizilerini ayrı `ParsedField`ler olarak sırayla üretir —
 * `rtcp.ts`nin compound-paket döngüsüne benzer bir "art arda dizili birimler"
 * yürüyüşü, ama birim sınırı bir uzunluk alanı değil IAC baytının kendisi.
 *
 * ── IAC ESCAPING: FF FF BİRLEŞTİRİLMEZ, AYRI ALAN OLARAK GÖSTERİLİR ──────────
 * Literal `0xFF` göndermek `FF FF` gerektirir (RFC 854). Bu iki bayt bitişik
 * metin koşusuna SESSİZCE eklenmez — spec'in "byte-transparency görünümü"
 * istediği yer burası: kaçışın TAM OLARAK nerede geçtiği kendi alanında
 * görünür kalır, önceki/sonraki metin koşularıyla birleştirilmez.
 *
 * ── WILL/WONT/DO/DONT: TEK KOMUTUN ANLAMI, ÇAPRAZ-KORELASYON DEĞİL ───────────
 * Spec'in örneği ("Client DO ECHO → Server WILL ECHO → Result: Accepted")
 * İKİ AYRI komutun BİRLİKTE yorumudur — DNS Transaction Matching / RTCP'nin
 * SR-RR eşleşmesi gibi çok-birimli bir korelasyon, bu dalganın tekrar eden
 * "parser tek birim çözer, korelasyon analyzer'ındır" çizgisine göre BURADA
 * YAPILMAZ. Her negotiation komutu KENDİ RFC 854 anlamıyla (DO = "peer'dan
 * etkinleştirmesini iste", WILL = "etkinleştirmeyi sun/onayla" …) tek başına
 * gösterilir — bu, ikinci bir komuta bakmadan da doğru ve tam bir yorumdur.
 *
 * ── SUBNEGOTIATION VERİSİ YORUMLANMAZ ────────────────────────────────────────
 * `IAC SB … IAC SE` arasındaki veri option'a özgüdür (ör. Terminal Type'ın
 * kendi alt biçimi) — spec bunun AÇILIMINI vermiyor, `coap.ts`nin option
 * DEĞERLERİNİ ham bırakma kararının aynısı: option kodu adlandırılır, veri
 * ham gösterilir.
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

const PROTOCOL_ID = 'telnet';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Telnet';

const IAC = 0xff;
const SE = 240;
const NOP = 241;
const DM = 242;
const BRK = 243;
const IP = 244;
const AO = 245;
const AYT = 246;
const EC = 247;
const EL = 248;
const GA = 249;
const SB = 250;
const WILL = 251;
const WONT = 252;
const DO = 253;
const DONT = 254;

/** RFC 854 §"Standard Commands" — bağımsız (argümansız) komutlar. */
const STANDALONE_COMMAND_NAMES: ReadonlyMap<number, string> = new Map([
  [SE, 'SE (Subnegotiation End)'],
  [NOP, 'NOP (No Operation)'],
  [DM, 'DM (Data Mark)'],
  [BRK, 'BRK (Break)'],
  [IP, 'IP (Interrupt Process)'],
  [AO, 'AO (Abort Output)'],
  [AYT, 'AYT (Are You There)'],
  [EC, 'EC (Erase Character)'],
  [EL, 'EL (Erase Line)'],
  [GA, 'GA (Go Ahead)'],
]);

/** RFC 854 §"Option negotiation" — dört komutun KENDİ (çapraz-korelasyonsuz) anlamı. */
const NEGOTIATION_VERB_MEANINGS: ReadonlyMap<number, { readonly name: string; readonly meaning: string }> = new Map([
  [WILL, { name: 'WILL', meaning: 'Offers/confirms to enable' }],
  [WONT, { name: 'WONT', meaning: 'Refuses/disables' }],
  [DO, { name: 'DO', meaning: 'Requests the peer to enable' }],
  [DONT, { name: 'DONT', meaning: 'Requests the peer to disable' }],
]);

/** IANA Telnet Options — spec'in adı geçen ECHO'su + yaygın RFC-standart olanlar. */
const OPTION_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'BINARY TRANSMISSION'],
  [1, 'ECHO'],
  [3, 'SUPPRESS GO AHEAD'],
  [5, 'STATUS'],
  [6, 'TIMING MARK'],
  [24, 'TERMINAL TYPE'],
  [31, 'NAWS (window size)'],
  [32, 'TERMINAL SPEED'],
  [33, 'REMOTE FLOW CONTROL'],
  [34, 'LINEMODE'],
  [39, 'NEW ENVIRON'],
]);

const ERROR_EMPTY_FRAME = 'protocol.telnet.error.emptyFrame';
const ERROR_TRAILING_IAC = 'protocol.telnet.error.trailingIac';
const ERROR_NEGOTIATION_TRUNCATED = 'protocol.telnet.error.negotiationTruncated';
const ERROR_UNKNOWN_COMMAND = 'protocol.telnet.error.unknownCommand';
const ERROR_SUBNEGOTIATION_UNTERMINATED = 'protocol.telnet.error.subnegotiationUnterminated';
const ERROR_FRAME_TOO_LONG = 'protocol.telnet.error.frameTooLong';
const ERROR_ABORTED = 'protocol.telnet.error.aborted';

/** Spec `08-ag-ethernet.md:676`: temel protokol şifreleme sağlamaz — HER çözümde sabit uyarı. */
const WARN_PLAINTEXT_PROTOCOL = 'protocol.telnet.warning.plaintextProtocol';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

const textDecoder = new TextDecoder('utf-8', { fatal: false });

function pushTextRun(data: Uint8Array, start: number, end: number, fields: ParsedField[]): void {
  if (end <= start) return;
  fields.push({
    id: `text-${String(start)}`,
    name: 'Text',
    offset: start,
    length: end - start,
    rawBytes: data.slice(start, end),
    physicalValue: textDecoder.decode(data.slice(start, end)),
    valid: true,
    warnings: [],
  });
}

function optionLabel(optionCode: number): string {
  const name = OPTION_NAMES.get(optionCode);
  return name === undefined ? `option ${String(optionCode)}` : name;
}

/**
 * Baştan sona tek geçişte metin koşularını ve IAC dizilerini sıralar. Hiçbir
 * dal `errors`e düşmeden döngü tamamlanırsa çerçeve geçerli sayılır —
 * `ftp.ts`nin "metin protokolü esnektir" kararının aynı cinsi, tek fark
 * burada gerçek bir yapısal hata (`IAC` sonrası tampon bitmesi, `SB`nin
 * `IAC SE` ile kapanmaması) VAR ve o zaman döngü durur.
 */
function walk(data: Uint8Array, fields: ParsedField[], errors: ProtocolError[]): void {
  let pos = 0;
  let textRunStart = 0;

  while (pos < data.length) {
    if (byteAt(data, pos) !== IAC) {
      pos += 1;
      continue;
    }

    pushTextRun(data, textRunStart, pos, fields);
    const iacOffset = pos;

    if (iacOffset + 1 >= data.length) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_TRAILING_IAC,
        offset: iacOffset,
        length: data.length - iacOffset,
      });
      return;
    }
    const next = byteAt(data, iacOffset + 1);

    if (next === IAC) {
      fields.push({
        id: `escaped-ff-${String(iacOffset)}`,
        name: 'Escaped Literal 0xFF',
        offset: iacOffset,
        length: 2,
        rawBytes: data.slice(iacOffset, iacOffset + 2),
        rawValue: 0xff,
        valid: true,
        warnings: [],
      });
      pos = iacOffset + 2;
      textRunStart = pos;
      continue;
    }

    const negotiationVerb = NEGOTIATION_VERB_MEANINGS.get(next);
    if (negotiationVerb !== undefined) {
      if (iacOffset + 2 >= data.length) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_NEGOTIATION_TRUNCATED,
          offset: iacOffset,
          length: data.length - iacOffset,
        });
        return;
      }
      const optionCode = byteAt(data, iacOffset + 2);
      fields.push({
        id: `negotiation-${String(iacOffset)}`,
        name: `IAC ${negotiationVerb.name}`,
        offset: iacOffset,
        length: 3,
        rawBytes: data.slice(iacOffset, iacOffset + 3),
        rawValue: optionCode,
        physicalValue: `${negotiationVerb.meaning} ${optionLabel(optionCode)}`,
        valid: true,
        warnings: [],
      });
      pos = iacOffset + 3;
      textRunStart = pos;
      continue;
    }

    if (next === SB) {
      if (iacOffset + 2 >= data.length) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_NEGOTIATION_TRUNCATED,
          offset: iacOffset,
          length: data.length - iacOffset,
        });
        return;
      }
      const optionCode = byteAt(data, iacOffset + 2);
      const subDataStart = iacOffset + 3;
      let scan = subDataStart;
      let seOffset = -1;
      while (scan < data.length) {
        if (byteAt(data, scan) === IAC) {
          if (scan + 1 < data.length && byteAt(data, scan + 1) === IAC) {
            scan += 2;
            continue;
          }
          if (scan + 1 < data.length && byteAt(data, scan + 1) === SE) {
            seOffset = scan;
            break;
          }
        }
        scan += 1;
      }
      if (seOffset === -1) {
        errors.push({
          code: 'truncated-frame',
          message: ERROR_SUBNEGOTIATION_UNTERMINATED,
          offset: iacOffset,
          length: data.length - iacOffset,
        });
        return;
      }
      fields.push({
        id: `subnegotiation-option-${String(iacOffset)}`,
        name: 'IAC SB Option',
        offset: iacOffset,
        length: 3,
        rawBytes: data.slice(iacOffset, subDataStart),
        rawValue: optionCode,
        physicalValue: optionLabel(optionCode),
        valid: true,
        warnings: [],
      });
      if (seOffset > subDataStart) {
        fields.push({
          id: `subnegotiation-data-${String(subDataStart)}`,
          name: 'Subnegotiation Data',
          offset: subDataStart,
          length: seOffset - subDataStart,
          rawBytes: data.slice(subDataStart, seOffset),
          unit: 'B',
          valid: true,
          warnings: [],
        });
      }
      pos = seOffset + 2;
      textRunStart = pos;
      continue;
    }

    const standaloneName = STANDALONE_COMMAND_NAMES.get(next);
    if (standaloneName !== undefined) {
      fields.push({
        id: `command-${String(iacOffset)}`,
        name: `IAC ${standaloneName}`,
        offset: iacOffset,
        length: 2,
        rawBytes: data.slice(iacOffset, iacOffset + 2),
        rawValue: next,
        valid: true,
        warnings: [],
      });
      pos = iacOffset + 2;
      textRunStart = pos;
      continue;
    }

    // RFC 854 240-255 aralığının tamamı yukarıdaki dallarla kapalı; buraya
    // düşülmesi imkansız olmalı ama noUncheckedIndexedAccess disiplininin
    // aynısı — kapsam dışına asla sessizce geçilmez.
    errors.push({
      code: 'unsupported-encoding',
      message: ERROR_UNKNOWN_COMMAND,
      offset: iacOffset,
      length: 2,
      details: { commandByte: next },
    });
    return;
  }

  pushTextRun(data, textRunStart, pos, fields);
}

interface TelnetParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function finishFrame(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: TelnetParseOptions,
): ParseResult {
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

function parseTelnetFrame(data: Uint8Array, options: TelnetParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: options.maxFrameLength,
        length: data.length - options.maxFrameLength,
        details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
      },
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

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [toProtocolWarning(WARN_PLAINTEXT_PROTOCOL)];
  const errors: ProtocolError[] = [];

  walk(data, fields, errors);

  return finishFrame(data, fields, warnings, errors, options);
}

export function parseTelnet(data: Uint8Array): ParseResult {
  return parseTelnetFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): TelnetParseOptions {
  const options: TelnetParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const telnetParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: en az 1 bayt — metin/kontrol karışımı akışta bundan fazlası spekülasyon olur. */
  canParse(data: Uint8Array): boolean {
    return data.length > 0;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseTelnetFrame(data, readContextOptions(context));
  },
};

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'echo-negotiation',
    name: 'protocol.telnet.example.echoNegotiation.name',
    // Client IAC DO ECHO ardından sunucu bilgi istemi metni.
    bytes: Uint8Array.from([
      IAC, DO, 1, 0x6c, 0x6f, 0x67, 0x69, 0x6e, 0x3a, 0x20, // "login: "
    ]),
    description: 'protocol.telnet.example.echoNegotiation.description',
    expectedValid: true,
  },
  {
    id: 'terminal-type-subnegotiation',
    name: 'protocol.telnet.example.terminalTypeSubnegotiation.name',
    // IAC WILL TERMINAL-TYPE, ardından IAC SB 24 0 "VT100" IAC SE.
    bytes: Uint8Array.from([
      IAC, WILL, 24, IAC, SB, 24, 0, 0x56, 0x54, 0x31, 0x30, 0x30, IAC, SE,
    ]),
    description: 'protocol.telnet.example.terminalTypeSubnegotiation.description',
    expectedValid: true,
  },
  {
    id: 'escaped-literal-ff',
    name: 'protocol.telnet.example.escapedLiteralFf.name',
    // "A" + kaçışlı literal 0xFF + "B" — byte-transparency örneği.
    bytes: Uint8Array.from([0x41, IAC, IAC, 0x42]),
    description: 'protocol.telnet.example.escapedLiteralFf.description',
    expectedValid: true,
  },
  {
    id: 'unterminated-subnegotiation',
    name: 'protocol.telnet.example.unterminatedSubnegotiation.name',
    // IAC SB 24 "VT100" — IAC SE hiç gelmiyor, kesilmiş bir yakalama.
    bytes: Uint8Array.from([IAC, SB, 24, 0x56, 0x54, 0x31, 0x30, 0x30]),
    description: 'protocol.telnet.example.unterminatedSubnegotiation.description',
    expectedValid: false,
  },
];

export const telnetPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: telnetParser,
  documentation: {
    summary: 'protocol.telnet.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};
