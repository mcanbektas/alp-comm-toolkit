/**
 * SBUS — Futaba'nın ters çevrilmiş (inverted) 100000 baud seri RC veri yolu.
 * 25 baytlık sabit çerçeve: start byte + 22 bayt paketli 16×11-bit kanal +
 * flags + end byte. Faz 10, dalga 15c (`brief-faz10-dalga15c.md`).
 *
 * ── GİRDİ SÖZLEŞMESİ: HAM 25 baytlık SBUS çerçevesi, UART DEĞİL ────────────
 * UART taşıyıcısı (100000 baud, 8E2, INVERTED) parser'a HİÇ girmez —
 * `mavlink.ts`in "fiziksel taşıyıcı bir bayt akışı değildir, parser'a hiç
 * girmez" sınırı birebir. Ters çevirme donanım/sürücü işidir; bu motor DAİMA
 * düzeltilmiş (non-inverted), 25 baytlık bir bayt dizisi alır.
 *
 * ── KAYNAK (ana thread'in 2026-08-25 kaynak turu — DOĞRULANMIŞ) ────────────
 * Betaflight `rx/sbus.c` (`SBUS_FRAME_SIZE`=25, `SBUS_FRAME_BEGIN_BYTE`=0x0F,
 * end byte yorumu) + `rx/sbus_channels.h` (paketli kanal bitfield'ı, bayrak
 * bitleri 2-3) + `rx/sbus_channels.c` (bayrak bitleri 0-1 — BRİF DÜZELTMESİ
 * aşağıda) + spec özeti `06-havacilik-uav.md:186-203`.
 *
 * ── BitOrder = lsb-first (bu dosyanın EN KRİTİK kararı) ────────────────────
 * Betaflight `rx/sbus_channels.h:26-47`: 16 adet `unsigned int chanN : 11`
 * `__attribute__((__packed__))` — C bitfield'ları little-endian hedefte
 * LSB-FIRST paketlenir (`chan0`ın ilk biti ilk baytın EN DÜŞÜK bitidir).
 * `bitCursor.ts`in VARSAYILANI `msb-first`tir ve BURADA YANLIŞTIR — sıra
 * AÇIKÇA `'lsb-first'` geçilir (`packedChannels.ts` üzerinden). Yanlış sıra
 * hata VERMEZ, yalnız değer yanlış çıkar; `packedChannels.test.ts` bunu elle
 * hesaplanmış bir fixture'la KANITLAR (bu dosyadan ÖNCE yazıldı).
 *
 * ── ÇERÇEVE ──────────────────────────────────────────────────────────────
 *   [0]      Start byte = 0x0F (SBUS_FRAME_BEGIN_BYTE, sbus.c:71)
 *   [1..22]  22 bayt paketli kanal verisi — 16 × 11 bit, lsb-first
 *   [23]     Flags — bit0 Digital CH17 · bit1 Digital CH18 ·
 *            bit2 Signal Loss (SBUS_FLAG_SIGNAL_LOSS) ·
 *            bit3 Failsafe Active (SBUS_FLAG_FAILSAFE_ACTIVE)
 *   [24]     End byte
 *
 * BRİF DÜZELTMESİ (ana thread, 2026-08-25): dijital kanal bayrakları
 * (bit0/bit1) `sbus_channels.h:25-28`de DEĞİL, `sbus_channels.c:38-39`de
 * tanımlı (`SBUS_FLAG_CHANNEL_17`/`SBUS_FLAG_CHANNEL_18`) — değerler brifin
 * dediği gibi doğru, yalnız dosya atfı yanlıştı; burada düzeltilmiş atıfla
 * yazılıyor (ayrıca bkz. `docs/brief-faz10-dalga15c.md` "Çürüyen tahminler").
 *
 * Signal Loss ve Failsafe Active AYRI bitlerdir (spec özeti `:200`) — tek bir
 * "RC LINK DEGRADED" göstergesine İNDİRGENMEZ, iki alan AYRI basılır.
 *
 * ── End byte: sabit DEĞER VARSAYILMAZ ───────────────────────────────────────
 * `rx/sbus.c:98` yorumu birebir: "The endByte is 0x00 on FrSky and some
 * futaba RX's, on some SBUS2 RX's the value indicates the telemetry byte
 * that is sent after every 4th sbus frame." Belgelenmiş TEK bir sabit yok —
 * değer HAM basılır, doğrulanmaz.
 *
 * ── GÖMÜLMEYECEKLER (spec `:203`, katalog yorumu `aerospace-uav.ts:239-241`) ─
 * • 173–1812 aralığı bir NORMALİZASYON sabitidir, protokol sabiti DEĞİL —
 *   `sbus_channels.c:41-42`deki `SBUS_DIGITAL_CHANNEL_MIN/MAX` bile dijital
 *   kanal 17/18'e ATANAN değerlerdir, tel üstündeki oransal aralık değil.
 *   Kanal alanları HAM sayı basar, `unit` VERİLMEZ.
 * • µs dönüşümü GÖMÜLMEZ: `sbus_channels.c:93-95`teki `(5×x/8)+880` yorumu
 *   kendi söylüyor — "Linear fitting values read from OpenTX-ppmus and
 *   comparing with values received by X4R" — tek bir alıcıya ampirik
 *   uydurma, protokol sabiti DEĞİL.
 * • Roll/Pitch/Throttle/Yaw adları GÖMÜLMEZ (`mavlink.ts`in "MESSAGE ID
 *   ADLANDIRILMAZ" kararının aynısı — kullanıcı eşlemesidir, protokol değil).
 * • Failsafe state machine (spec `:409`: NORMAL→…→RECOVERING) PARSER'A
 *   GİRMEZ — çerçeveler arası durum, analyzer işi (`mavlink.ts`in SEQ-LOSS
 *   kararı). Bu motor yalnız TEK çerçevedeki iki bayrağı gösterir.
 *
 * ── ALAN ADLANDIRMA (devralınan tuzaklar) ───────────────────────────────────
 * `ParsedField.offset`/`length` BAYT cinsindendir; 11-bit kanal alanı için
 * KAPSAYAN bayt aralığı verilir (CH1 → bayt 1–2), bit ayrıntısı alan ADINDA:
 * `CH1 (bit 0:10)` (`rtp.ts`/`rtcp.ts` emsali). `ParsedField.id` KANAL
 * İNDEKSİNİ taşır (`sbus-channel-0`…`sbus-channel-15`), offset'i DEĞİL —
 * ardışık iki kanal aynı baytı paylaştığı için offset id için güvenilmez.
 *
 * ── Rozet: `ready` ─────────────────────────────────────────────────────────
 * Alan yapısının TAMAMI çözülür, iki bağımsız kaynak (spec + Betaflight)
 * örtüşüyor. Checksum YOK — doğrulanacak bir bütünlük alanı olmaması
 * `partial` GEREKÇESİ DEĞİLDİR (protokolde yok, eksik uygulama değil).
 *
 * ── `decodeOptions` AÇILMAZ ──────────────────────────────────────────────────
 * Çerçeve yorumu için seçilecek bir parametre yok — çerçeve sabit uzunluklu
 * ve sabit düzenli (`ibus.ts`in `profile` seçeneğinin AKSİNE).
 *
 * ── `canParse`: ÜÇÜNCÜ KANIT YOK ─────────────────────────────────────────────
 * Checksum olmadığı için doğrulanacak tek şey uzunluk (tam 25) ve start byte
 * (0x0F). `rcCanParseRegistry.test.ts` bunun registry çapında kaç yabancı
 * çerçeveyi yanlış pozitif kabul ettiğini ÖLÇER ve raporlar (14f'in "%54"
 * dersi, `pulseLog.ts:63-68`).
 */

import { packedChannelByteSpan, readPackedChannels } from '@/protocol-core/decoding/packedChannels';
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

const PROTOCOL_ID = 'sbus';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'SBUS';

const FRAME_LENGTH = 25;
const START_BYTE = 0x0f;
const CHANNEL_DATA_OFFSET = 1;
const CHANNEL_COUNT = 16;
const CHANNEL_BITS = 11;
const FLAGS_OFFSET = 23;
const END_BYTE_OFFSET = 24;

// `sbus_channels.c:38-39` (BRİF DÜZELTMESİ — dosya başı notu).
const FLAG_CHANNEL_17_BIT = 0;
const FLAG_CHANNEL_18_BIT = 1;
// `sbus_channels.h:26-27`.
const FLAG_SIGNAL_LOSS_BIT = 2;
const FLAG_FAILSAFE_ACTIVE_BIT = 3;

const ERROR_FRAME_TOO_SHORT = 'protocol.sbus.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.sbus.error.frameTooLong';
const ERROR_INVALID_START_BYTE = 'protocol.sbus.error.invalidStartByte';
const ERROR_ABORTED = 'protocol.sbus.error.aborted';

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** Bir bayrak bitini `ParsedField`e çevirir — `dronecan.ts`in tail byte `flagField`iyle AYNI desen. */
function flagField(data: Uint8Array, id: string, name: string, bitIndex: number): ParsedField {
  const byte = byteAt(data, FLAGS_OFFSET);
  const active = ((byte >> bitIndex) & 0x1) === 1;
  return {
    id,
    name,
    offset: FLAGS_OFFSET,
    length: 1,
    rawBytes: data.slice(FLAGS_OFFSET, FLAGS_OFFSET + 1),
    rawValue: active ? 1 : 0,
    physicalValue: active ? 'Set' : 'Not set',
    valid: true,
    warnings: [],
  };
}

/** Bir kanal alanını `ParsedField`e çevirir. `id` kanal İNDEKSİNİ taşır (dosya başı "Alan adlandırma"). */
function channelField(data: Uint8Array, channelIndex: number, value: number): ParsedField {
  const span = packedChannelByteSpan(CHANNEL_DATA_OFFSET, channelIndex, CHANNEL_BITS);
  return {
    id: `sbus-channel-${String(channelIndex)}`,
    name: `CH${String(channelIndex + 1)} (bit 0:10)`,
    offset: span.offset,
    length: span.length,
    rawBytes: data.slice(span.offset, span.offset + span.length),
    // Ham paketli değer — `unit` BİLEREK yok (dosya başı "Gömülmeyecekler").
    rawValue: value,
    valid: true,
    warnings: [],
  };
}

interface SbusParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
}

function parseSbusFrame(data: Uint8Array, options: SbusParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: FRAME_LENGTH },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  if (data.length > FRAME_LENGTH) {
    // SBUS sabit uzunluklu bir çerçevedir (DroneCAN'in DLC ile değişen
    // payload'unun AKSİNE) — fazla bayt malformed girdi sayılır.
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: FRAME_LENGTH,
        length: data.length - FRAME_LENGTH,
        details: { maxFrameLength: FRAME_LENGTH, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];
  const fields: ParsedField[] = [];

  const startByte = byteAt(data, 0);
  const startByteValid = startByte === START_BYTE;
  fields.push({
    id: 'start-byte',
    name: 'Start Byte',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: startByte,
    valid: startByteValid,
    warnings: [],
  });
  if (!startByteValid) {
    // Uzunluk zaten tam 25 — geri kalan alanlar sabit offset'te olduğu için
    // yine de çözülür (spec §47 "hatalı veride uygulamayı çökertme").
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_INVALID_START_BYTE,
      offset: 0,
      length: 1,
      details: { expected: START_BYTE, actual: startByte },
    });
  }

  const channels = readPackedChannels(data, CHANNEL_DATA_OFFSET, CHANNEL_COUNT, CHANNEL_BITS, 'lsb-first');
  channels.forEach((value, index) => {
    fields.push(channelField(data, index, value));
  });

  fields.push(
    flagField(data, 'digital-channel-17', 'Digital Channel 17', FLAG_CHANNEL_17_BIT),
    flagField(data, 'digital-channel-18', 'Digital Channel 18', FLAG_CHANNEL_18_BIT),
    flagField(data, 'frame-lost', 'Frame Lost / Signal Loss', FLAG_SIGNAL_LOSS_BIT),
    flagField(data, 'failsafe-active', 'Failsafe Active', FLAG_FAILSAFE_ACTIVE_BIT),
  );

  fields.push({
    id: 'end-byte',
    name: 'End Byte',
    offset: END_BYTE_OFFSET,
    length: 1,
    rawBytes: data.slice(END_BYTE_OFFSET, END_BYTE_OFFSET + 1),
    // Belgelenmiş bir sabit YOK (dosya başı) — ham basılır, doğrulanmaz.
    rawValue: byteAt(data, END_BYTE_OFFSET),
    valid: true,
    warnings: [],
  });

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

export function parseSbus(data: Uint8Array): ParseResult {
  return parseSbusFrame(data, {});
}

export const sbusParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Checksum YOK — üçüncü kanıt yok, yalnız uzunluk (tam 25) + start byte
   * (0x0F). `rcCanParseRegistry.test.ts` bunun registry çapındaki yanlış
   * pozitif oranını ÖLÇER (dosya başı).
   */
  canParse(data: Uint8Array): boolean {
    return data.length === FRAME_LENGTH && data[0] === START_BYTE;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: SbusParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseSbusFrame(data, options);
  },
};

/**
 * 16 kanal: 0, 100, 200, …, 1500 — `packedChannels.test.ts`teki `BitOrder`
 * kanıt fixture'ıyla AYNI değerler ve AYNI 22 bayt (çapraz doğrulanmış,
 * bağımsız türetim orada belgeli). Burada TEKRAR üretmek yerine aynı baytlar
 * kullanılıyor ki iki dosya birbirini sessizce çelişmesin.
 */
const TYPICAL_CHANNEL_DATA = Uint8Array.from([
  0x00, 0x20, 0x03, 0x32, 0x58, 0x02, 0x19, 0xfa, 0x60, 0x89, 0x57, 0x20, 0x23, 0x1c, 0xfa, 0x98,
  0x08, 0x4b, 0x8a, 0xe2, 0x95, 0xbb,
]);

function buildSbusFrame(
  flags: number,
  startByte: number = START_BYTE,
  channelData: Uint8Array = TYPICAL_CHANNEL_DATA,
  endByte = 0x00,
): Uint8Array {
  return Uint8Array.from([startByte, ...channelData, flags, endByte]);
}

const FLAGS_NONE = 0x00;
const FLAGS_SIGNAL_LOSS_AND_FAILSAFE = (1 << FLAG_SIGNAL_LOSS_BIT) | (1 << FLAG_FAILSAFE_ACTIVE_BIT);
const FLAGS_DIGITAL_17_AND_18 = (1 << FLAG_CHANNEL_17_BIT) | (1 << FLAG_CHANNEL_18_BIT);

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'typical-frame',
    name: 'protocol.sbus.example.typicalFrame.name',
    bytes: buildSbusFrame(FLAGS_NONE),
    description: 'protocol.sbus.example.typicalFrame.description',
    expectedValid: true,
  },
  {
    id: 'failsafe-and-signal-loss',
    name: 'protocol.sbus.example.failsafeAndSignalLoss.name',
    // Bit2 (Signal Loss) VE bit3 (Failsafe Active) birlikte set — iki AYRI
    // alan olarak gösterildiği kanıtlanır (dosya başı).
    bytes: buildSbusFrame(FLAGS_SIGNAL_LOSS_AND_FAILSAFE),
    description: 'protocol.sbus.example.failsafeAndSignalLoss.description',
    expectedValid: true,
  },
  {
    id: 'digital-channels-17-18',
    name: 'protocol.sbus.example.digitalChannels1718.name',
    bytes: buildSbusFrame(FLAGS_DIGITAL_17_AND_18),
    description: 'protocol.sbus.example.digitalChannels1718.description',
    expectedValid: true,
  },
  {
    id: 'invalid-start-byte',
    name: 'protocol.sbus.example.invalidStartByte.name',
    // Start byte 0x0F yerine 0x00 — uzunluk yine 25, kalan alanlar yine de
    // çözülür (spec §47), yalnız `valid:false` ve start-delimiter-not-found.
    bytes: buildSbusFrame(FLAGS_NONE, 0x00),
    description: 'protocol.sbus.example.invalidStartByte.description',
    expectedValid: false,
  },
];

export const sbusPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: sbusParser,
  documentation: {
    summary: 'protocol.sbus.documentation.summary',
    layer: 'data-link',
    references: [
      {
        title: 'Betaflight — rx/sbus.c, rx/sbus_channels.h, rx/sbus_channels.c',
        url: 'https://github.com/betaflight/betaflight/blob/master/src/main/rx/sbus.c',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
