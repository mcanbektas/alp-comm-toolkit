/**
 * FlexRay — ISO 17458 ailesi / FlexRay Communications System Protocol
 * Specification v3.0.1.
 *
 * Faz 10, dalga 14e (`docs/brief-faz10-dalga14e.md`). Dalganın görünmez-değişmez
 * riski en yüksek kaydı: iki CRC'si de katalogda yoktu ve biri bayt hizasız.
 *
 * ── KAYNAK UYARISI: ISO 17458 ÜCRETLİ, SPEC ÖZETİ YETMİYOR ───────────────────
 * Depodaki spec özeti alan ADLARINI veriyor ama HİÇBİR bit genişliğini, CRC
 * polinomunu, Payload Length'in birimini ya da gösterge bitlerinin sırasını
 * vermiyor. FlexRay Consortium 2009'da dağıldı. Bu yüzden alt dalganın ilk adımı
 * kaynak turu oldu (dalga 13 mimari bulgu 1) ve dört doğrulama noktasının HER
 * BİRİ İKİ BAĞIMSIZ AÇIK KAYNAKLA çapraz doğrulandı:
 *
 *   • Wireshark `epan/dissectors/packet-flexray.c` + `.h` (GPL-2.0-or-later)
 *   • `dynm/pico-flexray` `src/flexray_frame.c` + `utils/crc{11,24}_generator.c`
 *   • CRC RevEng "Catalogue of parametrised CRC algorithms" — `CRC-11/FLEXRAY`,
 *     `CRC-24/FLEXRAY-A`, `CRC-24/FLEXRAY-B` girdileri (üçü de ATTESTED sınıfı,
 *     kaynağı spec v3.0.1 §4.2.8/§4.4/§4.5 ve Conformance Test Spec §2.7.5)
 *
 * ── 1) PAYLOAD LENGTH'İN BİRİMİ: BAYT DEĞİL, 2 BAYTLIK SÖZCÜK ───────────────
 * Bu alt dalganın en olası SESSİZ hatasıydı — yanlış okumak payload sınırını
 * İKİ KAT kaydırır ve Frame CRC'yi HER çerçevede yanlış çıkarır. Üç kaynak da
 * aynı tabanı veriyor:
 *   • Wireshark: `int flexray_real_payload_length = 2 * flexray_pl;`
 *   • pico-flexray: `uint8_t payload_length_words; // 7 bits (number of 16-bit
 *     words)` ve her kullanımda `* 2`
 *   • Conformance Test Spec'in 10 frame codeword'ünün ONUNDA da
 *     `payloadLength * 2 === gerçek payload bayt sayısı`
 * Bu yüzden alan HAM sözcük sayısını `rawValue`, BAYT karşılığını
 * `physicalValue` olarak basar — ayrım kullanıcıya görünür kalsın diye.
 *
 * ── 2) HEADER CRC TAM 20 BİTİ KAPSAR (5 gösterge bitinin YALNIZ İKİSİ) ──────
 * Kapsam = Sync Frame Indicator + Startup Frame Indicator + Frame ID[11] +
 * Payload Length[7] = 20 bit. Reserved bit, Payload Preamble Indicator, Null
 * Frame Indicator ve Cycle Count KAPSAM DIŞIDIR. Brief "gösterge bitleri"
 * diyordu; doğrusu beşin yalnız ikisi — brief'in çürüyen tahmini bu.
 *
 * İki bağımsız kanıt:
 *   • pico-flexray `calculate_flexray_header_crc`: `(raw_buffer[0] & 0b11111)
 *     << 16 | raw_buffer[1] << 8 | raw_buffer[2]`, ardından `>>= 1` — yani
 *     bayt 0'ın alt 5 biti (sfi, stfi, fid[10:8]) + bayt 1 + bayt 2'nin üst 7
 *     biti. Tam olarak yukarıdaki 20 bit.
 *   • reveng'in `CRC-11/FLEXRAY` codeword'leri 31 BİT uzunluğunda: 20 bit mesaj
 *     + 11 bit CRC. Dördü de bu alan kırılımıyla doğrulanıyor
 *     (`crcEngine.test.ts`).
 * Ayrıca bu motorla üretilen başlıklarda res/ppi/nfi/cycleCount değişince
 * header CRC DEĞİŞMİYOR, sfi/stfi/frameId/payloadLength değişince DEĞİŞİYOR —
 * kapsamın kendi testi (`flexray.test.ts`).
 *
 * 20 bit = 2.5 bayttır ve `crc()` bayt bayt döner. Bu yüzden `crcEngine.ts`e
 * `crcBits` kardeşi eklendi (açık soru 4, karar ve gerekçe o dosyanın başında).
 *
 * ── 3) FRAME CRC INIT'İ KANALA GÖRE DEĞİŞİR → `decodeOptions` AÇILDI ────────
 * Polinom aynı (0x5D6DCB), init farklı: kanal A 0xFEDCBA, kanal B 0xABCDEF.
 * reveng'in kendi notu: *"Channels A and B have different initial vectors to
 * prevent frames crossing channels."* Conformance Test Spec §2.7.5 aynı 5
 * mesajı iki kez, iki farklı CRC ile veriyor — 10 codeword'ün onu da bu motorla
 * yeniden üretildi.
 *
 * Kanal çerçevenin İÇİNDE DEĞİLDİR (yakalama metadata'sı). Brief `decodeOptions`
 * açmayı SON ÇARE sayıyor ve tanıdığı tek meşru gerekçe tam olarak buydu:
 * "kaynak turunun Frame CRC init'inin kanala göre değiştiğini KANITLAMASI".
 * Kanıtlandı, bu yüzden `channel` bir `select` kanalıdır. Çözüm sırası:
 * `options.channel` → `ParseContext.channel` (`types.ts:127`, brief'in "önce
 * bunu dene" dediği alan) → varsayılan A.
 *
 * ── 4) GÖSTERGE BİTLERİ: 5 TANE, SIRASI SABİT ──────────────────────────────
 * bit 0 Reserved, bit 1 Payload Preamble Indicator, bit 2 Null Frame Indicator,
 * bit 3 Sync Frame Indicator, bit 4 Startup Frame Indicator. Wireshark'ın
 * maskeleri (`FLEXRAY_RES_MASK 0x80`, `PPI 0x40`, `NFI 0x20`, `SFI 0x10`,
 * `STFI 0x08`) ve pico-flexray'in `indicators = header[0] >> 3`'ü BİREBİR
 * örtüşüyor.
 *
 * ── `BitOrder`: msb-first ───────────────────────────────────────────────────
 * Bit 0, ilk baytın EN YÜKSEK bitidir. Kanıt: Wireshark'ın maskeleri bu
 * numaralandırmayla birebir oturuyor (Frame ID = `0x07ff` üzerinden 16-bit
 * okuma → bit 5..15; Header CRC = `0x01ffc0 >> 6` üzerinden 24-bit okuma →
 * bit 23..33) ve 20 bitlik header CRC ancak bu sırayla codeword'leri yeniden
 * üretiyor. Yanlış sıra küçük Frame ID'lerde doğru görünüp büyüklerde bozulurdu
 * (12e OID hatasının sınıfı) — burada CRC o hatayı ANINDA yakalar, çünkü Frame
 * ID CRC kapsamındadır.
 *
 * ── ÇERÇEVE AĞACI ALAN ADLARIYLA ───────────────────────────────────────────
 * `ParsedFrame` DÜZ, `children` YOK (CLAUDE.md kilitli kararı). Spec'in
 * Header/Payload/Trailer ağacı alan ADLARINDA taşınır (`Header Frame ID`,
 * `Trailer Frame CRC`) — 12g'nin RTCP çözümü. `ParsedField.offset`/`length`
 * BAYT cinsindendir; bit alanları için KAPSAYAN bayt aralığı verilir ve bit
 * ayrıntısı adda durur (`rtp.ts`/`rtcp.ts` emsali).
 *
 * ── KAPSAM: NEYİN ÇÖZÜLDÜĞÜ, NEYİN ÇÖZÜLMEDİĞİ ─────────────────────────────
 * Girdi TEK BİR FlexRay ÇERÇEVESİDİR (Header + Payload + Trailer), kanal
 * yakalamasının tamamı değil.
 *
 * Çözülen: beş gösterge biti, Frame ID, Payload Length (birimiyle), Header CRC
 * (DOĞRULANIR), Cycle Count, payload sınırı, Frame CRC (DOĞRULANIR, kanala
 * göre). İki CRC de "yalnız gösterilir" sınıfında DEĞİL, GERÇEKTEN doğrulanır —
 * parametreleri iki bağımsız kaynakla ve 14 conformance codeword'üyle sınandı
 * (dalga 13 dersi 3'ün AS-i/PROFIBUS tarafı, Sercos/CC-Link IE tarafı değil).
 *
 * Çözülmeyen: payload'ın İÇİ. FlexRay payload'ının yapısı telden ÇIKMAZ, FIBEX
 * ya da AUTOSAR ARXML ekleme tanımından gelir — 12g RTP ve 14d SOME/IP'nin aynı
 * sınırı, HAM gösterilir + uyarılır, sahte alan kırılımı UYDURULMAZ (dalga 13
 * dersi 4). Payload Preamble Indicator set olduğunda payload'ın başındaki şeyin
 * Network Management Vector mı Message ID mi olduğu ÇERÇEVEDE YOKTUR (statik mi
 * dinamik segment mi olduğuna bağlı, o da çevrim yapılandırmasında) — bu yüzden
 * preamble AYRIŞTIRILMAZ, yalnız varlığı bildirilir.
 *
 * Communication cycle (Static/Dynamic/Symbol Window/NIT), slot-cycle
 * korelasyonu, missing static frame, slot violation, cycle timing error →
 * ANALYZER işidir, tek çerçeve çözümünün değil; emsal iki kez kurulu ve
 * ikisinde de kayıt `ready` kapandı (12c DNS, 12d PTP). Korelasyonun HAMMADDESİ
 * (`frameId`, `cycleCount`, `channel`) `RawFrame.metadata`ya yazılır ki ileriki
 * analyzer işi onu bulsun.
 *
 * Çift kanal/topoloji HESABI bu kayıtta YOK: onu `interfaces-framing/
 * vehicle-field-physical-layers/flexray-phy` kaydı zaten karşılıyor
 * (`calculatorIds: ['flexray-phy-timing']`). Bu yüzden `flexray`
 * `calculatorIds` ALMAZ, yalnız `related` ile ona bağlanır.
 */

import { computeNamedCrc, computeNamedCrcBits } from '@/protocol-core/checksums/crcCatalogue';
import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
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

const PROTOCOL_ID = 'flexray';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'FlexRay';

/** Header segmenti sabit 5 bayttır — Wireshark `FLEXRAY_HEADER_LENGTH 5`. */
const HEADER_LENGTH = 5;
/** Trailer segmenti: 24 bitlik Frame CRC, big-endian. */
const FRAME_CRC_LENGTH = 3;
/** Payload'sız (Payload Length = 0) en kısa geçerli çerçeve. */
const MIN_FRAME_LENGTH = HEADER_LENGTH + FRAME_CRC_LENGTH;

/**
 * Başlığın MUTLAK bit konumları (msb-first, bit 0 = bayt 0'ın en yüksek biti).
 * Bayt maskeleriyle DEĞİL bit konumlarıyla yazıldı: `bitCursor` zaten bu dilde
 * konuşuyor ve maske/kaydırma çiftleri elle yazıldığında kolayca kayıyor.
 */
const BIT_RESERVED = 0;
const BIT_PAYLOAD_PREAMBLE = 1;
const BIT_NULL_FRAME = 2;
const BIT_SYNC_FRAME = 3;
const BIT_STARTUP_FRAME = 4;
const BIT_FRAME_ID = 5;
const FRAME_ID_BITS = 11;
const BIT_PAYLOAD_LENGTH = 16;
const PAYLOAD_LENGTH_BITS = 7;
const BIT_HEADER_CRC = 23;
const HEADER_CRC_BITS = 11;
const BIT_CYCLE_COUNT = 34;
const CYCLE_COUNT_BITS = 6;

/**
 * Header CRC'nin kapsadığı bit aralığı: Sync Frame Indicator'dan (bit 3) Payload
 * Length'in sonuna (bit 22 dahil) kadar KESİNTİSİZ 20 bit. Kesintisiz olması
 * tesadüf değil — spec alanları CRC kapsamı bitişik olsun diye dizmiş.
 */
const HEADER_CRC_COVERAGE_START_BIT = BIT_SYNC_FRAME;
const HEADER_CRC_COVERAGE_BITS = 20;

/** Payload Length sözcük sayısıdır; bir sözcük 2 bayttır (dosya başı, madde 1). */
const BYTES_PER_PAYLOAD_WORD = 2;

const CHANNEL_A = 'a';
const CHANNEL_B = 'b';
type FlexRayChannel = typeof CHANNEL_A | typeof CHANNEL_B;

const OPTION_CHANNEL = 'channel';

/**
 * Tek `decodeOptions` kanalı — brief'in "kanal açmak SON ÇARE" kuralının tanıdığı
 * TEK meşru gerekçeyle açıldı: Frame CRC'nin init'i kanala göre değişiyor ve
 * kanal çerçevenin içinde yok, yani DOĞRULAMA buna bağlı (dosya başı, madde 3).
 */
const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_CHANNEL,
    label: 'protocol.flexray.option.channel',
    kind: 'select',
    defaultValue: CHANNEL_A,
    description: 'protocol.flexray.option.channel.description',
    choices: [
      { value: CHANNEL_A, label: 'protocol.flexray.option.channel.a' },
      { value: CHANNEL_B, label: 'protocol.flexray.option.channel.b' },
    ],
  },
];

const ERROR_FRAME_TOO_SHORT = 'protocol.flexray.error.frameTooShort';
const ERROR_PAYLOAD_TRUNCATED = 'protocol.flexray.error.payloadTruncated';
const ERROR_HEADER_CRC_MISMATCH = 'protocol.flexray.error.headerCrcMismatch';
const ERROR_FRAME_CRC_MISMATCH = 'protocol.flexray.error.frameCrcMismatch';
const ERROR_ABORTED = 'protocol.flexray.error.aborted';

const WARN_HEADER_CRC_MISMATCH = 'protocol.flexray.warning.headerCrcMismatch';
const WARN_FRAME_CRC_MISMATCH = 'protocol.flexray.warning.frameCrcMismatch';
const WARN_RESERVED_BIT_SET = 'protocol.flexray.warning.reservedBitSet';
const WARN_PAYLOAD_NEEDS_DEFINITION = 'protocol.flexray.warning.payloadNeedsDefinition';
const WARN_PAYLOAD_PREAMBLE_PRESENT = 'protocol.flexray.warning.payloadPreamblePresent';
const WARN_NULL_FRAME_HAS_DATA = 'protocol.flexray.warning.nullFrameHasData';
const WARN_CHANNEL_ASSUMED = 'protocol.flexray.warning.channelAssumed';
const WARN_TRAILING_BYTES = 'protocol.flexray.warning.trailingBytes';

const SUMMARY_DATA_FRAME = 'protocol.flexray.summary.dataFrame';
const SUMMARY_NULL_FRAME = 'protocol.flexray.summary.nullFrame';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toHex(value: number, digits: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(digits, '0')}`;
}

/**
 * Header CRC'nin 20 bitini SOLA DAYALI 3 bayta paketler: `crcBits` girdiyi
 * bayt 0'ın en yüksek bitinden saymaya başlar, bizim 20 bitimiz ise bayt 0'ın
 * bit 3'ünden başlıyor. Kaydırma burada TEK YERDE yapılır — her çağıranın kendi
 * dolgu kuralını uydurması tam olarak `crcEngine.ts`in reddettiği şeydi.
 *
 * Son baytın alt 4 biti sıfır kalır ve `crcBits(…, 20, …)` onlara HİÇ BAKMAZ
 * (kendi testi var); yani burada bir "dolgu kuralı" yok, yalnız hizalama var.
 */
function packHeaderCrcCoverage(data: Uint8Array): Uint8Array {
  const packed = new Uint8Array(3);
  for (let index = 0; index < HEADER_CRC_COVERAGE_BITS; index += 1) {
    const sourceBit = HEADER_CRC_COVERAGE_START_BIT + index;
    const bit = readBitsAsNumber(data, sourceBit, 1);
    if (bit === 1) {
      const targetByte = index >> 3;
      // noUncheckedIndexedAccess: sabit uzunluklu dizide bile tip `| undefined`.
      packed[targetByte] = (packed[targetByte] ?? 0) | (0x80 >> (index & 7));
    }
  }
  return packed;
}

interface FlexRayParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
  /** Frame CRC init'ini seçen kanal — `types.ts:127` önce, `options` üstünde. */
  crcChannel: FlexRayChannel;
  /** Kanal hiçbir yerden gelmediyse true; kullanıcı varsayıldığını görmeli. */
  channelAssumed: boolean;
}

/**
 * Kanal çözüm sırası: `options.channel` (panelin açık seçimi) → `ParseContext.
 * channel` (yakalamanın taşıdığı alan, brief'in "önce bunu dene" dediği yer) →
 * varsayılan A. Panel her zaman `defaultValue`yu gönderdiği için pratikte
 * ekranda seçim, dosyadan gelen akışta ise yakalama alanı kazanır.
 */
function resolveParseOptions(context: ParseContext | undefined): FlexRayParseOptions {
  const rawOption = context?.options?.[OPTION_CHANNEL];
  const optionChannel =
    rawOption === CHANNEL_B ? CHANNEL_B : rawOption === CHANNEL_A ? CHANNEL_A : undefined;
  const contextChannel = context?.channel?.trim().toLowerCase();
  const frameChannel =
    contextChannel === CHANNEL_B || contextChannel === 'b'
      ? CHANNEL_B
      : contextChannel === CHANNEL_A || contextChannel === 'a'
        ? CHANNEL_A
        : undefined;

  const crcChannel = optionChannel ?? frameChannel ?? CHANNEL_A;
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    crcChannel,
    channelAssumed: optionChannel === undefined && frameChannel === undefined,
  };
}

/** Bir gösterge bitini alan olarak basar — beşi de aynı yoldan geçer. */
function indicatorField(
  data: Uint8Array,
  id: string,
  name: string,
  bitPosition: number,
  labels: readonly [clear: string, set: string],
  warnings: string[] = [],
): ParsedField {
  const value = readBitsAsNumber(data, bitPosition, 1);
  return {
    id,
    name,
    // Beş gösterge de bayt 0'ın içinde: KAPSAYAN bayt aralığı 1 bayttır,
    // bit ayrıntısı adda (`types.ts:30` kilitli sözleşmesi).
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: value,
    physicalValue: labels[value === 1 ? 1 : 0],
    valid: true,
    warnings,
  };
}

/**
 * `interface` DEĞİL `type`: TypeScript yalnız type alias'lara örtük index
 * imzası verir, `interface` `Record<string, unknown>`e atanamaz ve
 * `RawFrame.metadata`ya yazılamaz (rtcm.ts:115 aynı sebeple type kullanıyor).
 */
export type FlexRayFrameMetadata = {
  frameId: number;
  cycleCount: number;
  payloadLengthWords: number;
  channel: FlexRayChannel;
  nullFrame: boolean;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function parseFlexRay(data: Uint8Array, context?: ParseContext): ParseResult {
  const options = resolveParseOptions(context);

  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MIN_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
        details: { minimumLength: String(MIN_FRAME_LENGTH), actualLength: String(data.length) },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const payloadLengthWords = readBitsAsNumber(data, BIT_PAYLOAD_LENGTH, PAYLOAD_LENGTH_BITS);
  const payloadLengthBytes = payloadLengthWords * BYTES_PER_PAYLOAD_WORD;
  const frameCrcOffset = HEADER_LENGTH + payloadLengthBytes;
  const frameLength = frameCrcOffset + FRAME_CRC_LENGTH;

  if (data.length < frameLength) {
    // Payload Length'in VAAT ETTİĞİ bayt yok — bu bir akış parçasıdır, kısmi
    // çözüm göstermek yanıltıcı olurdu (14d SOME/IP `messageIncomplete` çizgisi).
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_PAYLOAD_TRUNCATED,
        offset: 0,
        length: data.length,
        details: {
          payloadLengthWords: String(payloadLengthWords),
          expectedLength: String(frameLength),
          actualLength: String(data.length),
        },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields: ParsedField[] = [];
  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];

  // ── Gösterge bitleri (bayt 0, bit 0-4) ────────────────────────────────────
  const reservedBit = readBitsAsNumber(data, BIT_RESERVED, 1);
  fields.push(
    indicatorField(
      data,
      'reserved-bit',
      'Header Reserved Bit (bit 0)',
      BIT_RESERVED,
      ['Clear (as specified)', 'Set (should be 0)'],
      reservedBit === 1 ? [WARN_RESERVED_BIT_SET] : [],
    ),
  );
  if (reservedBit === 1) {
    warnings.push(toProtocolWarning(WARN_RESERVED_BIT_SET));
  }

  const payloadPreamble = readBitsAsNumber(data, BIT_PAYLOAD_PREAMBLE, 1);
  fields.push(
    indicatorField(
      data,
      'payload-preamble-indicator',
      'Header Payload Preamble Indicator (bit 1)',
      BIT_PAYLOAD_PREAMBLE,
      ['No payload preamble', 'Payload preamble present'],
      payloadPreamble === 1 ? [WARN_PAYLOAD_PREAMBLE_PRESENT] : [],
    ),
  );
  if (payloadPreamble === 1) {
    // Preamble'ın Network Management Vector mı Message ID mi olduğu çerçevede
    // YOKTUR (statik/dinamik segment ayrımına bağlı) — ayrıştırılmaz, bildirilir.
    warnings.push(toProtocolWarning(WARN_PAYLOAD_PREAMBLE_PRESENT));
  }

  // Null Frame Indicator TERSTİR: 1 = veri taşıyan çerçeve, 0 = null frame.
  // Wireshark `if (nfi) { … }` ve "Payload is optional on Null Frames" yorumu.
  const nullFrameIndicator = readBitsAsNumber(data, BIT_NULL_FRAME, 1);
  const isNullFrame = nullFrameIndicator === 0;
  fields.push(
    indicatorField(data, 'null-frame-indicator', 'Header Null Frame Indicator (bit 2)', BIT_NULL_FRAME, [
      'Null frame (no payload data)',
      'Data frame',
    ]),
  );

  fields.push(
    indicatorField(data, 'sync-frame-indicator', 'Header Sync Frame Indicator (bit 3)', BIT_SYNC_FRAME, [
      'Not a sync frame',
      'Sync frame',
    ]),
  );
  fields.push(
    indicatorField(
      data,
      'startup-frame-indicator',
      'Header Startup Frame Indicator (bit 4)',
      BIT_STARTUP_FRAME,
      ['Not a startup frame', 'Startup frame'],
    ),
  );

  // ── Frame ID (bit 5-15) — bayt 0-1'e YAYILIR, kapsayan aralık 2 bayt ──────
  const frameId = readBitsAsNumber(data, BIT_FRAME_ID, FRAME_ID_BITS);
  fields.push({
    id: 'frame-id',
    name: 'Header Frame ID (bits 5-15)',
    offset: 0,
    length: 2,
    rawBytes: data.slice(0, 2),
    rawValue: frameId,
    physicalValue: toHex(frameId, 3),
    valid: true,
    warnings: [],
  });

  // ── Payload Length (bit 16-22) — SÖZCÜK sayısı, bayt DEĞİL ────────────────
  fields.push({
    id: 'payload-length',
    name: 'Header Payload Length (bits 16-22, 2-byte words)',
    offset: 2,
    length: 1,
    rawBytes: data.slice(2, 3),
    rawValue: payloadLengthWords,
    // `unit` gerçek fiziksel birime: bayt bir uzunluk birimidir, sözcük değil.
    physicalValue: payloadLengthBytes,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  // ── Header CRC (bit 23-33) — bayt 2-4'e YAYILIR, 20 bit üzerinden DOĞRULANIR ─
  const receivedHeaderCrc = readBitsAsNumber(data, BIT_HEADER_CRC, HEADER_CRC_BITS);
  const computedHeaderCrc = Number(
    computeNamedCrcBits(packHeaderCrcCoverage(data), HEADER_CRC_COVERAGE_BITS, 'CRC11_FLEXRAY'),
  );
  const headerCrcValid = receivedHeaderCrc === computedHeaderCrc;
  fields.push({
    id: 'header-crc',
    name: 'Header CRC-11 (bits 23-33)',
    offset: 2,
    length: 3,
    rawBytes: data.slice(2, 5),
    rawValue: receivedHeaderCrc,
    physicalValue: headerCrcValid ? 'Valid' : `Invalid (computed ${toHex(computedHeaderCrc, 3)})`,
    valid: headerCrcValid,
    warnings: headerCrcValid ? [] : [WARN_HEADER_CRC_MISMATCH],
  });
  if (!headerCrcValid) {
    errors.push({
      code: 'crc-mismatch',
      message: ERROR_HEADER_CRC_MISMATCH,
      offset: 2,
      length: 3,
      details: {
        received: toHex(receivedHeaderCrc, 3),
        computed: toHex(computedHeaderCrc, 3),
      },
    });
  }

  // ── Cycle Count (bit 34-39) ───────────────────────────────────────────────
  const cycleCount = readBitsAsNumber(data, BIT_CYCLE_COUNT, CYCLE_COUNT_BITS);
  fields.push({
    id: 'cycle-count',
    name: 'Header Cycle Count (bits 34-39)',
    offset: 4,
    length: 1,
    rawBytes: data.slice(4, 5),
    rawValue: cycleCount,
    valid: true,
    warnings: [],
  });

  // ── Payload — HAM kalır, FIBEX/ARXML olmadan çözülemez ────────────────────
  if (payloadLengthBytes > 0) {
    const payloadBytes = data.slice(HEADER_LENGTH, frameCrcOffset);
    const payloadWarnings = [WARN_PAYLOAD_NEEDS_DEFINITION];
    const nullFrameCarriesData = isNullFrame && payloadBytes.some((byte) => byte !== 0);
    if (nullFrameCarriesData) {
      payloadWarnings.push(WARN_NULL_FRAME_HAS_DATA);
      warnings.push(toProtocolWarning(WARN_NULL_FRAME_HAS_DATA));
    }
    fields.push({
      id: 'payload',
      name: 'Payload',
      offset: HEADER_LENGTH,
      length: payloadLengthBytes,
      rawBytes: payloadBytes,
      // `rawValue` BİLEREK yok: payload bir sayı değil, yapısı telden çıkmayan
      // bir bayt dizisidir (14d SOME/IP ve 12g RTP kararı).
      valid: true,
      warnings: payloadWarnings,
    });
    warnings.push(toProtocolWarning(WARN_PAYLOAD_NEEDS_DEFINITION));
  }

  // ── Trailer: Frame CRC (24 bit, big-endian) — kanala göre DOĞRULANIR ──────
  const receivedFrameCrc =
    (byteAt(data, frameCrcOffset) << 16) |
    (byteAt(data, frameCrcOffset + 1) << 8) |
    byteAt(data, frameCrcOffset + 2);
  const frameCrcAlgorithm = options.crcChannel === CHANNEL_B ? 'CRC24_FLEXRAY_B' : 'CRC24_FLEXRAY_A';
  const computedFrameCrc = Number(computeNamedCrc(data.slice(0, frameCrcOffset), frameCrcAlgorithm));
  const frameCrcValid = receivedFrameCrc === computedFrameCrc;
  const channelLabel = options.crcChannel === CHANNEL_B ? 'Channel B' : 'Channel A';
  const frameCrcWarnings = frameCrcValid ? [] : [WARN_FRAME_CRC_MISMATCH];
  if (options.channelAssumed) {
    // Kanal hiçbir yerden gelmedi: doğrulama VARSAYILAN init'le yapıldı ve
    // yanlış kanal seçimi "geçerli çerçeve bozuk görünür" üretir — görünür olmalı.
    frameCrcWarnings.push(WARN_CHANNEL_ASSUMED);
    warnings.push(toProtocolWarning(WARN_CHANNEL_ASSUMED));
  }
  fields.push({
    id: 'frame-crc',
    name: `Trailer Frame CRC-24 (${channelLabel})`,
    offset: frameCrcOffset,
    length: FRAME_CRC_LENGTH,
    rawBytes: data.slice(frameCrcOffset, frameLength),
    rawValue: receivedFrameCrc,
    physicalValue: frameCrcValid ? 'Valid' : `Invalid (computed ${toHex(computedFrameCrc, 6)})`,
    valid: frameCrcValid,
    warnings: frameCrcWarnings,
  });
  if (!frameCrcValid) {
    errors.push({
      code: 'crc-mismatch',
      message: ERROR_FRAME_CRC_MISMATCH,
      offset: frameCrcOffset,
      length: FRAME_CRC_LENGTH,
      details: {
        received: toHex(receivedFrameCrc, 6),
        computed: toHex(computedFrameCrc, 6),
        channel: channelLabel,
      },
    });
  }

  if (data.length > frameLength) {
    const trailing = data.slice(frameLength);
    fields.push({
      id: 'trailing-data',
      name: 'Trailing Data',
      offset: frameLength,
      length: trailing.length,
      rawBytes: trailing,
      valid: false,
      warnings: [WARN_TRAILING_BYTES],
    });
    warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
  }

  const summaryKey = isNullFrame ? SUMMARY_NULL_FRAME : SUMMARY_DATA_FRAME;
  const summaryParams: Record<string, string> = {
    frameId: String(frameId),
    cycleCount: String(cycleCount),
    payloadLength: String(payloadLengthBytes),
  };

  // Slot/cycle korelasyonu ANALYZER işidir; hammaddesi burada bırakılır.
  const metadata: FlexRayFrameMetadata = {
    frameId,
    cycleCount,
    payloadLengthWords,
    channel: options.crcChannel,
    nullFrame: isNullFrame,
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

export const flexRayParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,
  /**
   * Ucuz ön eleme (`types.ts:178`): CRC hesaplanmaz, yalnız uzunluk tutarlılığı
   * bakılır. Payload Length çerçevenin toplam boyunu VERDİĞİ için bu eleme
   * sanıldığından seçici: rastgele bir bayt dizisinin 3. baytındaki 7 bitin
   * gerçek uzunlukla örtüşme olasılığı düşüktür.
   */
  canParse(data: Uint8Array): boolean {
    if (data.length < MIN_FRAME_LENGTH) return false;
    const payloadLengthWords = readBitsAsNumber(data, BIT_PAYLOAD_LENGTH, PAYLOAD_LENGTH_BITS);
    return HEADER_LENGTH + payloadLengthWords * BYTES_PER_PAYLOAD_WORD + FRAME_CRC_LENGTH <= data.length;
  },
  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseFlexRay(data, context);
  },
};

/**
 * Örnek çerçeveler. İlk ikisi UYDURULMADI: FlexRay Protocol Conformance Test
 * Specification v3.0.1 §2.7.5'in codeword'leridir (reveng kataloğu üzerinden) —
 * aynı mesaj, kanal A ve kanal B için farklı Frame CRC. Geri kalanlar bu motorun
 * doğrulanmış CRC'leriyle üretildi ve `flexray.test.ts` her birini yeniden
 * hesaplayarak sınıyor.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'conformance-channel-a',
    name: 'protocol.flexray.example.conformanceChannelA.name',
    // Conformance Test Spec §2.7.5 codeword 1 (CRC-24/FLEXRAY-A).
    // sync+startup, Frame ID 2, Payload Length 1 sözcük (2 bayt), Cycle 8.
    bytes: Uint8Array.from([0x18, 0x02, 0x02, 0x09, 0x88, 0x00, 0x00, 0xf3, 0x39, 0xc1]),
    description: 'protocol.flexray.example.conformanceChannelA.description',
    expectedValid: true,
  },
  {
    id: 'conformance-channel-b',
    name: 'protocol.flexray.example.conformanceChannelB.name',
    // AYNI mesaj, Conformance Test Spec'in kanal B codeword'ü (CRC-24/FLEXRAY-B).
    // Kanal A'da açılırsa Frame CRC GEÇERSİZ çıkar — init farkının kanıtı.
    bytes: Uint8Array.from([0x18, 0x02, 0x02, 0x09, 0x88, 0x00, 0x00, 0xd5, 0xb9, 0x10]),
    description: 'protocol.flexray.example.conformanceChannelB.description',
    expectedValid: true,
  },
  {
    id: 'data-frame',
    name: 'protocol.flexray.example.dataFrame.name',
    // Frame ID 100, Payload Length 4 sözcük = 8 BAYT, Cycle 17, kanal A.
    bytes: Uint8Array.from([
      0x20, 0x64, 0x09, 0x9a, 0x11, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0xb1, 0x7e,
      0xe9,
    ]),
    description: 'protocol.flexray.example.dataFrame.description',
    expectedValid: true,
  },
  {
    id: 'null-frame',
    name: 'protocol.flexray.example.nullFrame.name',
    // Null Frame Indicator 0 → null frame; payload alanı var ama sıfır.
    bytes: Uint8Array.from([0x00, 0x28, 0x04, 0xfc, 0xc3, 0x00, 0x00, 0x00, 0x00, 0x79, 0xfd, 0xeb]),
    description: 'protocol.flexray.example.nullFrame.description',
    expectedValid: true,
  },
  {
    id: 'payload-preamble',
    name: 'protocol.flexray.example.payloadPreamble.name',
    // PPI 1 — preamble VAR ama NMV mi Message ID mi olduğu çerçevede yok.
    bytes: Uint8Array.from([
      0x60, 0x07, 0x07, 0x8b, 0x8c, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x55, 0xd6, 0xa3,
    ]),
    description: 'protocol.flexray.example.payloadPreamble.description',
    expectedValid: true,
  },
  {
    id: 'bad-header-crc',
    name: 'protocol.flexray.example.badHeaderCrc.name',
    // `data-frame`in 3. baytı bozuldu (0x9A → 0xBA): Header CRC tutmaz ama
    // Frame CRC de tutmaz — ikisi AYRI AYRI raporlanır.
    bytes: Uint8Array.from([
      0x20, 0x64, 0x09, 0xba, 0x11, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0xb1, 0x7e,
      0xe9,
    ]),
    description: 'protocol.flexray.example.badHeaderCrc.description',
    expectedValid: false,
  },
  {
    id: 'bad-frame-crc',
    name: 'protocol.flexray.example.badFrameCrc.name',
    // Yalnız Frame CRC'nin son baytı bozuldu: Header CRC GEÇERLİ kalır.
    // "İki CRC ayrı ayrı doğrulanır" iddiasının tek çerçevelik kanıtı.
    bytes: Uint8Array.from([
      0x20, 0x64, 0x09, 0x9a, 0x11, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0xb1, 0x7e,
      0x16,
    ]),
    description: 'protocol.flexray.example.badFrameCrc.description',
    expectedValid: false,
  },
  {
    id: 'truncated-frame',
    name: 'protocol.flexray.example.truncatedFrame.name',
    // Payload Length 4 sözcük (8 bayt) vaat ediyor → 16 bayt gerek, 10 var.
    bytes: Uint8Array.from([0x20, 0x64, 0x09, 0x9a, 0x11, 0x11, 0x22, 0x33, 0x44, 0x55]),
    description: 'protocol.flexray.example.truncatedFrame.description',
    expectedValid: false,
  },
];

export const flexRayPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: flexRayParser,
  documentation: {
    summary: 'protocol.flexray.documentation.summary',
    layer: 'data-link',
    references: [
      {
        title: 'CRC RevEng — CRC-11/FLEXRAY, CRC-24/FLEXRAY-A, CRC-24/FLEXRAY-B',
        url: 'https://reveng.sourceforge.io/crc-catalogue/all.htm',
      },
      {
        title: 'Wireshark — epan/dissectors/packet-flexray.c (GPL-2.0-or-later)',
        url: 'https://gitlab.com/wireshark/wireshark/-/blob/master/epan/dissectors/packet-flexray.c',
      },
      {
        title: 'pico-flexray — src/flexray_frame.c, utils/crc11_generator.c',
        url: 'https://github.com/dynm/pico-flexray',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
