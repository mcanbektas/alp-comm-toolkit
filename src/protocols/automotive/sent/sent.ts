/**
 * SENT — Single Edge Nibble Transmission (SAE J2716), Faz 10 dalga 14g.
 * `sensor-interfaces` ailesinin üç kaydından ilki (`spc` bu dosyanın nibble
 * çözücüsünü TÜKETİR — aşağı bak; üçüncüsü `psi5`, dalga 14h, AYRI yoldan).
 *
 * ── Girdi KONTEYNERİ: 14f'ten DEVRALINDI, YENİDEN TASARLANMADI ─────────────
 * Nabız günlüğü sözleşmesinin TAM tanımı `@/protocol-core/decoding/pulseLog.ts`
 * dosya başındadır (`Uint16LE`, 0.1 µs birim, çift uzunluk, rezerve 0 kuralı).
 * Bu dosya yalnız SENT'e ÖZEL çözümü ekler: nibble türetimi, senkron darbeden
 * tick süresi kestirimi, CRC'nin gösterim durumu.
 *
 * ── Çözüm zinciri (spec `ozet/04-otomotiv.md:151`) ─────────────────────────
 * "Önce calibration/sync pulse'tan Estimated Tick Time çıkarılır; ardından
 * her nibble Pulse duration → Tick count → Nibble value olarak decode edilir."
 * Fast Channel sırası (`:149`): Sync/Calibration Pulse → Status/Communication
 * Nibble → Data Nibble 1, 2, … → CRC Nibble → Optional Pause Pulse.
 *
 * ── Tick time: TELDEN ÇIKAR, SORULMAZ (12d PTP kararının TERSİ) ────────────
 * Spec `:151` net: tick süresi kalibrasyon darbesinden HESAPLANIR, kullanıcıdan
 * istenmez. 12d'de PTP T4 kanalı AÇILMAMIŞTI çünkü "kullanıcının bildiği ayar
 * değil, yakalama anında ölçülen değer"di; burada da tick süresi telin
 * İÇİNDEN çıkıyor — `decodeOptions`a giren tick time DEĞİL, PROFİLDİR
 * (nibble sayısı/CRC varyantı gibi telden ÇIKARILAMAYAN parametreler).
 *
 * ── Sayısal sabitler: İKİ BAĞIMSIZ KAYNAKLA ÇAPRAZLANDI ─────────────────────
 * SAE J2716 ücretli ve depoda YOK; spec özeti de ("Kesin timing sabitleri...
 * toolkit bunları evrensel sabit varsaymamalıdır", `:151`) kendi bunu söylüyor.
 * Aşağıdaki dört sayı EN AZ üç bağımsız kamuya açık kaynakla doğrulandı:
 *
 *   - **56 tick = senkron/kalibrasyon darbesi.** Wikipedia ("SENT (protocol)"),
 *     TI'nin MSPM0 SENT User's Guide'ı ("Synchronization/calibration pulse:
 *     56 ticks total"), PEAK-System'in SAE J2716 blog yazısı ve GERÇEK ÇALIŞAN
 *     bir sigrok/pulseview protokol çözücüsünün kaynak kodu
 *     (`enp6s0/sent-decoder`, `tickTime = (end - fall) / 56`) — DÖRDÜ de
 *     birebir aynı sayıyı veriyor.
 *   - **nibble = tick sayısı − 12, geçerli aralık [12, 27] tick (nibble
 *     0-15).** AYNI dört kaynak: Wikipedia ve PEAK-System "nibble değeri
 *     toplam tick sayısından on iki çıkarılarak bulunur" diyor, TI "12-27
 *     ticks total" aralığını doğruluyor, sigrok kod satırı BİREBİR
 *     `if(ticks >= 12 and ticks <= 27): actualValue = ticks - 12`. Bu depodaki
 *     spec özetinin ÇALIŞILMIŞ örneğiyle (`:151`, "Pulse 45.0 us, Tick 3.0 us
 *     → Pulse Ticks 15 → Decoded Nibble 0x3") TAM örtüşüyor (15−12=3) — hatta
 *     spec özetinin AÇILIŞ örneği ("Pulse 0: 168 us", `:151`) 56×3=168'in
 *     KENDİSİ, yani üç mikrosaniyelik bir tick'in kalibrasyon darbesi.
 *   - **Varsayılan 6 veri nibble'ı (standart Fast Channel mesajı).** TI ("Up
 *     to six Data nibble pulses"), Wikipedia ("24 bits of signal data (six
 *     nibbles)... two measurement channels of three nibbles each"),
 *     PEAK-System ("two measurement channels with twelve bits each" = 2×3
 *     nibble = 6) ve sigrok çözücüsünün KENDİ `dataNibblesCount` varsayılan
 *     seçeneği (`'default': 6`) — dördü de aynı sayıda.
 *   - **Tick aralığı [3, 90] µs.** Wikipedia ve PEAK-System birebir "3 ila 90
 *     mikrosaniye" diyor (TI'nin kendi MCU sürücüsü donanım nedeniyle bunu
 *     1 µs'ye kadar GENİŞLETİYOR — bu TI'nin UYGULAMA seçimi, SAE'nin spec
 *     değeri değil, o yüzden 3 µs alt sınırı kullanılıyor).
 *
 * ── CRC: GÖSTERİLİR, HESAPLANMAZ — dalga 13 dersi 3'ün ayrımı ───────────────
 * Spec `:155` Received/Calculated/PASS-FAIL üçünü istiyor AMA bu yalnız
 * polinom/başlangıç GERÇEKTEN iki bağımsız kaynakla teyitliyse yapılır. SENT'in
 * CRC-4'ü ARAŞTIRILDI (bkz. görev raporu) ve üç şey ortaya çıktı: (1) gerçek,
 * çalışan bir referans çözücü (`enp6s0/sent-decoder`) SENT CRC-4'ün klasik
 * bit-kaydırmalı bir CRC DEĞİL, seed=5 ile başlayan NIBBLE-ÖZYİNELEMELİ bir
 * tablo algoritması olduğunu gösteriyor; (2) bu çözücünün KENDİSİ üç
 * BİRBİRİYLE ÇAKIŞMAYAN varyant taşıyor: "J2716 Recommended" (varsayılan,
 * APR2016 revizyonu, ekstra bir sıfır-nibble turu ekliyor), "J2716 Legacy"
 * (bu turu ATLIYOR) ve "Infineon" (TLE4998 datasheet'ine özgü, TAMAMEN FARKLI
 * 16 girişli bir tablo kullanıyor VE status nibble'ı da hesaba katıyor — öteki
 * ikisi katmıyor); (3) resmi NXP sürücü uygulama notları (AN4432/AN4856) —
 * CRC bölümünü doğrudan içerecek belgeler — bu görevde İKİ AYRI araçla
 * (otomatik indeksleme + doğrudan fetch) denendi, ikisi de PDF metnini
 * kullanılabilir biçimde çıkaramadı. Yani polinom/başlangıç TEK bir açık
 * kaynak koduyla (üç varyantı BİRBİRİNE karşı) görülebildi, İKİNCİ bağımsız
 * birincil kaynakla ÇAPRAZLANAMADI. **Karar: CRC nibble'ı ALINDIĞI GİBİ
 * gösterilir (Received), Calculated/PASS-FAIL BASILMAZ, ve bu kullanıcıya
 * `WARN_CRC_NOT_VERIFIED` ile AÇIKÇA söylenir** (Sercos CRC32 / CC-Link IE HEC
 * emsali, dalga 13 dersi 3).
 *
 * **`CRC4_ITU` (`crcCatalogue.ts:46`) DEĞERLENDİRİLDİ VE REDDEDİLDİ** — dalga
 * 13 dersi 2'nin tam sınıfı ("aynı bit genişliği aynı algoritma değildir").
 * `CRC4_ITU` klasik bit-kaydırmalı, bit-yansıtmalı (refin/refout=true) bir
 * CRC'dir; SENT'in nibble-özyinelemeli, seed=5, yansıtmasız algoritmasıyla
 * HİÇBİR ortak hesaplama adımı yoktur — aynı 4 bit genişliği paylaşmaları
 * SAHTE DOSTLUK'un ta kendisi, kullanılmadı.
 *
 * ── `sent.ts`in nibble çözücüsü `spc.ts` tarafından TÜKETİLİR ──────────────
 * `decodeSentNibbles` `cipCore.ts`in `decodeCipMessage(data, offset, ...,
 * fields, warnings, errors)` imzasıyla AYNI sınıf: çekirdek kendi `ParseResult`
 * ÜRETMEZ, `fields`/`warnings`/`errors` dizilerine YAZAR. `startPulseIndex`
 * parametresi `spc.ts`in SENT yanıt çerçevesini KENDİ konteynerinin 1. nabzından
 * (tetik darbesinden SONRA) başlatarak AYNI fonksiyonu çağırmasını sağlar —
 * spc.ts İKİNCİ bir nibble çözücü YAZMAZ, bu testte kanıtlanır
 * (`spc.test.ts`, "aynı fonksiyon çağrılıyor" testi).
 *
 * ── Slow Channel: alan ADINDA belirtilir, şema DEĞİŞMEZ ────────────────────
 * Spec `:153`: Slow Channel Fast Channel'ın status/communication nibble'ından
 * taşınır ve toolkit AYRI bir stream üretmeli. `ParsedFrame` DÜZ (`types.ts`,
 * KİLİTLİ) — 12g'nin RTCP çözümü izlendi: `status` alanının `name`i bu ikinci
 * rolü açıkça anar. Status nibble'ının HANGİ bitinin (bitlerinin) Slow
 * Channel'a ait olduğuna dair bu depodaki hiçbir kaynakta bit-düzeyi bir
 * tablo YOK — bu yüzden belirli bir bit pozisyonu UYDURULMADI, yalnız
 * "bu nibble Slow Channel taşıyor, tam mesaj çok çerçeve ister, bu Analyzer'ın
 * işi" uyarısı verilir (`WARN_SLOW_CHANNEL_PARTIAL`).
 */

import type {
  DecodeOption,
  DecodeOptionChoice,
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
import { createRawFrame } from '@/protocol-core/types';
import {
  PULSE_STRIDE_BYTES,
  decodePulseLog,
  encodePulseLog,
  isWithinPulseBand,
  pulseByteSpan,
  type DecodedPulse,
} from '@/protocol-core/decoding/pulseLog';

const PROTOCOL_ID = 'sent';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'SENT';

// ── İki-bağımsız-kaynakla doğrulanmış sabitler (dosya başı kaynak notu) ────
/** Senkron/kalibrasyon darbesinin nominal tick sayısı. */
export const SENT_SYNC_TICKS = 56;
/** SAE J2716'nın tanımladığı tick süresi aralığı — SAE'nin KENDİ değeri (TI'nin donanım-özel 1 µs genişletmesi DEĞİL, dosya başı notu). */
export const SENT_TICK_MIN_US = 3;
export const SENT_TICK_MAX_US = 90;
/** Bir nibble darbesinin geçerli tick aralığı — nibble 0 → 12 tick, nibble 15 → 27 tick. */
export const SENT_NIBBLE_TICKS_MIN = 12;
export const SENT_NIBBLE_TICKS_MAX = 27;
export const SENT_MAX_NIBBLE_VALUE = SENT_NIBBLE_TICKS_MAX - SENT_NIBBLE_TICKS_MIN;
/** Standart Fast Channel mesajının veri nibble sayısı (iki 12-bit kanal × 3 nibble). */
export const SENT_DEFAULT_DATA_NIBBLE_COUNT = 6;
export const SENT_MIN_DATA_NIBBLE_COUNT = 1;
export const SENT_MAX_DATA_NIBBLE_COUNT = 6;

/** Senkron darbesinin MUTLAK süre bandı — `SENT_SYNC_TICKS × [SENT_TICK_MIN_US, SENT_TICK_MAX_US]`. Spec özetinin AÇILIŞ örneği (168 µs) bu bandın ALT SINIRININ KENDİSİDİR (56×3). */
export const SENT_SYNC_MIN_US = SENT_SYNC_TICKS * SENT_TICK_MIN_US;
export const SENT_SYNC_MAX_US = SENT_SYNC_TICKS * SENT_TICK_MAX_US;

/** `canParse`in ucuz yapısal tabanı: sync + status + en az 1 veri nibble'ı + CRC. */
const MIN_SIGNATURE_PULSES = 4;

const PROFILE_STANDARD = 'sae-j2716-standard-6-nibble';
const PROFILE_CUSTOM = 'custom';
/** Preset etiketi protokol VERİSİDİR, çeviriye girmez (`j1850Pwm.ts`in `PROFILE_STANDARD_LABEL`iyle aynı disiplin). */
export const SENT_PROFILE_STANDARD_LABEL = `SAE J2716 Standard (${String(SENT_DEFAULT_DATA_NIBBLE_COUNT)} data nibbles)`;
export const SENT_PROFILE_STANDARD = PROFILE_STANDARD;
export const SENT_PROFILE_CUSTOM = PROFILE_CUSTOM;

/**
 * `spc.ts`nin `sensorProfile` şıkkı bu diziyi DOĞRUDAN paylaşır (ikinci kez
 * yazılmaz, referans eşitliği `spc.test.ts`te kanıtlanır — brief karar,
 * 14c'nin `xcpOnCan.ts`ten `DECODE_OPTIONS` paylaşım deseninin aynısı).
 */
export const SENT_PROFILE_CHOICES: readonly DecodeOptionChoice[] = [
  { value: PROFILE_STANDARD, label: SENT_PROFILE_STANDARD_LABEL },
  { value: PROFILE_CUSTOM, label: 'protocol.sent.option.profile.custom' },
];

const OPTION_PROFILE = 'profile';
const OPTION_DATA_NIBBLE_COUNT = 'dataNibbleCount';

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_PROFILE,
    label: 'protocol.sent.option.profile',
    kind: 'select',
    defaultValue: PROFILE_STANDARD,
    description: 'protocol.sent.option.profile.description',
    choices: SENT_PROFILE_CHOICES,
  },
  {
    id: OPTION_DATA_NIBBLE_COUNT,
    label: 'protocol.sent.option.dataNibbleCount',
    kind: 'number',
    defaultValue: SENT_DEFAULT_DATA_NIBBLE_COUNT,
    min: SENT_MIN_DATA_NIBBLE_COUNT,
    max: SENT_MAX_DATA_NIBBLE_COUNT,
    description: 'protocol.sent.option.dataNibbleCount.description',
  },
];

const ERROR_EMPTY = 'protocol.sent.error.empty';
const ERROR_ODD_LENGTH = 'protocol.sent.error.oddLength';
const ERROR_TOO_SHORT = 'protocol.sent.error.tooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.sent.error.frameTooLong';
const ERROR_ABORTED = 'protocol.sent.error.aborted';
const ERROR_NIBBLE_OUT_OF_RANGE = 'protocol.sent.error.nibbleOutOfRange';

const WARN_SYNC_RESERVED = 'protocol.sent.warning.syncReserved';
const WARN_NIBBLE_RESERVED = 'protocol.sent.warning.nibbleReserved';
const WARN_NIBBLE_OUT_OF_BAND = 'protocol.sent.warning.nibbleOutOfBand';
const WARN_CRC_NOT_VERIFIED = 'protocol.sent.warning.crcNotVerified';
const WARN_TRAILING_PULSES = 'protocol.sent.warning.trailingPulses';
const WARN_SLOW_CHANNEL_PARTIAL = 'protocol.sent.warning.slowChannelPartial';

const SUMMARY_FRAME = 'protocol.sent.summary.frame';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/**
 * Senkron darbesinden SONRAKİ her nabız kendi ORANLI bandında olmalı —
 * `j1850Pulse.ts`in MUTLAK µs bandının SENT'teki karşılığı, ama SENT'in tick
 * süresi (3-90 µs) evrensel olmadığı için bant senkron darbesinden TÜRETİLİR
 * (brief'in kendi ifadesi: "SENT'in imzası kalibrasyon darbesinin ötekilere
 * ORANIdır, mutlak süresi değil"). Son nabız (varsa Pause) gevşek kontrol
 * edilir: Pause'un kendi süresi spec'te sayısal verilmediği için yalnız
 * "nibble alt sınırından KISA değil" aranır — pause frame'i UZATMAK için var,
 * kısaltmak için değil.
 */
export function sentSignatureFromPulses(pulses: readonly DecodedPulse[]): boolean {
  if (pulses.length < MIN_SIGNATURE_PULSES) return false;
  const sync = pulses[0];
  if (sync === undefined || !isWithinPulseBand(sync, SENT_SYNC_MIN_US, SENT_SYNC_MAX_US)) {
    return false;
  }
  const tickUs = sync.durationUs / SENT_SYNC_TICKS;
  const nibbleMinUs = SENT_NIBBLE_TICKS_MIN * tickUs;
  const nibbleMaxUs = SENT_NIBBLE_TICKS_MAX * tickUs;

  const lastIndex = pulses.length - 1;
  for (let index = 1; index < lastIndex; index += 1) {
    const pulse = pulses[index];
    if (pulse === undefined || !isWithinPulseBand(pulse, nibbleMinUs, nibbleMaxUs)) {
      return false;
    }
  }
  const last = pulses[lastIndex];
  return last !== undefined && isWithinPulseBand(last, nibbleMinUs, Number.POSITIVE_INFINITY);
}

interface ResolvedSentProfile {
  readonly dataNibbleCount: number;
  readonly label: string;
}

function clampDataNibbleCount(value: unknown): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= SENT_MIN_DATA_NIBBLE_COUNT &&
    value <= SENT_MAX_DATA_NIBBLE_COUNT
    ? value
    : SENT_DEFAULT_DATA_NIBBLE_COUNT;
}

/** `microwire.ts`in `resolveProfile`iyle AYNI desen: tanınmayan değer sessizce varsayılana düşer. */
export function resolveSentProfile(options: Record<string, unknown> | undefined): ResolvedSentProfile {
  const profileId = typeof options?.[OPTION_PROFILE] === 'string' ? options[OPTION_PROFILE] : PROFILE_STANDARD;
  if (profileId !== PROFILE_CUSTOM) {
    return { dataNibbleCount: SENT_DEFAULT_DATA_NIBBLE_COUNT, label: SENT_PROFILE_STANDARD_LABEL };
  }
  const dataNibbleCount = clampDataNibbleCount(options?.[OPTION_DATA_NIBBLE_COUNT]);
  return { dataNibbleCount, label: `Custom — ${String(dataNibbleCount)} data nibbles` };
}

export interface SentFrameSummary {
  readonly tickUs: number | undefined;
  readonly statusNibble: number | undefined;
  readonly dataNibbles: readonly (number | undefined)[];
  readonly crcReceivedNibble: number | undefined;
  readonly hasPause: boolean;
}

/**
 * SENT nibble çözücüsü — DIŞA AÇIK, `spc.ts` bunu ÇAĞIRIR (dosya başı notu).
 * `cipCore.ts`in `decodeCipMessage` imzasıyla AYNI sınıf: `ParseResult`
 * ÜRETMEZ, `fields`/`warnings`/`errors` dizilerine YAZAR. `startPulseIndex`
 * çağıranın konteynerindeki BAŞLANGIÇ nabzını verir — `sent.ts`in kendisi 0
 * geçer, `spc.ts` 1 geçer (tetik darbesinden SONRA).
 */
export function decodeSentNibbles(
  data: Uint8Array,
  pulses: readonly DecodedPulse[],
  startPulseIndex: number,
  dataNibbleCount: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): SentFrameSummary {
  const sync = pulses[startPulseIndex];
  const syncSpan = pulseByteSpan(startPulseIndex, 1);
  const syncReserved = sync === undefined || sync.reserved;

  fields.push({
    id: 'sync',
    name: 'Sync/Calibration Pulse',
    offset: syncSpan.offset,
    length: syncSpan.length,
    rawBytes: data.slice(syncSpan.offset, syncSpan.offset + syncSpan.length),
    ...(sync === undefined || sync.reserved
      ? {}
      : { rawValue: sync.rawRegister, physicalValue: sync.durationUs.toFixed(1), unit: 'µs' }),
    valid: !syncReserved,
    warnings: syncReserved ? [WARN_SYNC_RESERVED] : [],
  });
  if (syncReserved) {
    warnings.push(toProtocolWarning(WARN_SYNC_RESERVED));
  }

  const tickUs = syncReserved || sync === undefined ? undefined : sync.durationUs / SENT_SYNC_TICKS;

  // Spec `:151` "Estimated Tick Time" — kalibrasyon darbesinden TÜRETİLMİŞ bir
  // alan, kullanıcıdan istenmez (dosya başı notu). Aynı bayt aralığını
  // sync'le PAYLAŞIR: ikisi de FİZİKSEL olarak aynı ölçümü temsil eder.
  fields.push({
    id: 'estimatedTickTime',
    name: 'Estimated Tick Time (derived)',
    offset: syncSpan.offset,
    length: syncSpan.length,
    rawBytes: data.slice(syncSpan.offset, syncSpan.offset + syncSpan.length),
    ...(tickUs === undefined ? {} : { physicalValue: tickUs.toFixed(3), unit: 'µs' }),
    valid: tickUs !== undefined,
    warnings: tickUs === undefined ? [WARN_SYNC_RESERVED] : [],
  });

  function decodeNibblePulse(
    pulseIndex: number,
    id: string,
    name: string,
    extraWarnings: readonly string[] = [],
  ): number | undefined {
    const pulse = pulses[pulseIndex];
    const span = pulseByteSpan(pulseIndex, 1);
    const rawBytes = data.slice(span.offset, span.offset + span.length);

    if (tickUs === undefined) {
      // Senkron darbesi rezerve olduğu için tick süresi yok — nibble ÇÖZÜLEMEZ.
      fields.push({
        id,
        name,
        offset: span.offset,
        length: span.length,
        rawBytes,
        ...(pulse === undefined || pulse.reserved ? {} : { rawValue: pulse.rawRegister }),
        valid: false,
        warnings: [WARN_SYNC_RESERVED, ...extraWarnings],
      });
      return undefined;
    }

    if (pulse === undefined || pulse.reserved) {
      fields.push({
        id,
        name,
        offset: span.offset,
        length: span.length,
        rawBytes,
        valid: false,
        warnings: [WARN_NIBBLE_RESERVED, ...extraWarnings],
      });
      warnings.push(toProtocolWarning(WARN_NIBBLE_RESERVED));
      return undefined;
    }

    const ticks = Math.round(pulse.durationUs / tickUs);
    const inBand = ticks >= SENT_NIBBLE_TICKS_MIN && ticks <= SENT_NIBBLE_TICKS_MAX;
    const value = inBand ? ticks - SENT_NIBBLE_TICKS_MIN : undefined;

    fields.push({
      id,
      name,
      offset: span.offset,
      length: span.length,
      rawBytes,
      rawValue: pulse.rawRegister,
      ...(value === undefined ? {} : { physicalValue: value }),
      valid: inBand,
      warnings: inBand ? extraWarnings.slice() : [WARN_NIBBLE_OUT_OF_BAND, ...extraWarnings],
    });
    if (!inBand) {
      errors.push({
        code: 'value-out-of-range',
        message: ERROR_NIBBLE_OUT_OF_RANGE,
        offset: span.offset,
        length: span.length,
        details: { ticks, validRangeTicks: [SENT_NIBBLE_TICKS_MIN, SENT_NIBBLE_TICKS_MAX] },
      });
    }
    return value;
  }

  const statusNibble = decodeNibblePulse(
    startPulseIndex + 1,
    'status',
    'Status/Communication Nibble (carries Slow Channel bits across frames)',
    [WARN_SLOW_CHANNEL_PARTIAL],
  );
  warnings.push(toProtocolWarning(WARN_SLOW_CHANNEL_PARTIAL));

  const dataNibbles: (number | undefined)[] = [];
  for (let i = 0; i < dataNibbleCount; i += 1) {
    dataNibbles.push(decodeNibblePulse(startPulseIndex + 2 + i, `data-nibble-${String(i + 1)}`, `Data Nibble ${String(i + 1)}`));
  }

  const crcPulseIndex = startPulseIndex + 2 + dataNibbleCount;
  const crcReceivedNibble = decodeNibblePulse(crcPulseIndex, 'crc', 'CRC Nibble (received, not verified)', [
    WARN_CRC_NOT_VERIFIED,
  ]);
  warnings.push(toProtocolWarning(WARN_CRC_NOT_VERIFIED));

  // Optional Pause Pulse — spec `:149`/`:153`, yalnız BEKLENEN son nabızdan
  // SONRA bir kayıt daha varsa gösterilir (madde: sayı-tabanlı çıkarım).
  const pausePulseIndex = crcPulseIndex + 1;
  let hasPause = false;
  if (pulses.length > pausePulseIndex) {
    const pausePulse = pulses[pausePulseIndex];
    if (pausePulse !== undefined) {
      hasPause = true;
      const pauseSpan = pulseByteSpan(pausePulseIndex, 1);
      fields.push({
        id: 'pause',
        name: 'Pause Pulse',
        offset: pauseSpan.offset,
        length: pauseSpan.length,
        rawBytes: data.slice(pauseSpan.offset, pauseSpan.offset + pauseSpan.length),
        ...(pausePulse.reserved
          ? {}
          : { rawValue: pausePulse.rawRegister, physicalValue: pausePulse.durationUs.toFixed(1), unit: 'µs' }),
        valid: !pausePulse.reserved,
        warnings: [],
      });
    }
    if (pulses.length > pausePulseIndex + 1) {
      warnings.push(toProtocolWarning(WARN_TRAILING_PULSES));
    }
  }

  return { tickUs, statusNibble, dataNibbles, crcReceivedNibble, hasPause };
}

interface SentParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
}

function resolveParseOptions(context: ParseContext | undefined): SentParseOptions {
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    ...(context?.options === undefined ? {} : { options: context.options }),
  };
}

export type SentFrameMetadata = {
  dataNibbleCount: number;
  statusNibble: number | undefined;
  crcReceivedNibble: number | undefined;
  hasPause: boolean;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

function parseSentFrame(data: Uint8Array, options: SentParseOptions): ParseResult {
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

  const decoded = decodePulseLog(data);
  if (!decoded.ok) {
    return {
      success: false,
      error:
        decoded.failure.kind === 'empty'
          ? { code: 'truncated-frame', message: ERROR_EMPTY, offset: 0, length: 0 }
          : {
              code: 'truncated-frame',
              message: ERROR_ODD_LENGTH,
              offset: 0,
              length: decoded.failure.length,
              details: { length: decoded.failure.length },
            },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const pulses = decoded.result.pulses;
  const resolved = resolveSentProfile(options.options);
  const requiredPulses = 1 + 1 + resolved.dataNibbleCount + 1; // sync + status + data + crc

  if (pulses.length < requiredPulses) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_TOO_SHORT,
        offset: 0,
        length: data.length,
        details: { pulseCount: pulses.length, requiredPulses },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  // İlk satır YÜRÜRLÜKTEKİ PROFİL — `microwire.ts`/`j1850Pwm.ts` deseni:
  // preset seçiliyken sayı alanının YOK SAYILDIĞI yalnız burada görünür.
  fields.push({
    id: 'profile',
    name: 'Profile',
    offset: 0,
    length: 0,
    rawBytes: new Uint8Array(),
    rawValue: resolved.label,
    valid: true,
    warnings: [],
  });

  const summary = decodeSentNibbles(data, pulses, 0, resolved.dataNibbleCount, fields, warnings, errors);

  const metadata: SentFrameMetadata = {
    dataNibbleCount: resolved.dataNibbleCount,
    statusNibble: summary.statusNibble,
    crcReceivedNibble: summary.crcReceivedNibble,
    hasPause: summary.hasPause,
    summaryKey: SUMMARY_FRAME,
    summaryParams: { dataNibbleCount: String(resolved.dataNibbleCount) },
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

export function parseSent(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parseSentFrame(data, options === undefined ? {} : { options });
}

export const sentParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme — `sentSignatureFromPulses` (dosya içi, yukarı). SENT'in
   * imzası kalibrasyon darbesinin ÖTEKİLERE ORANIdır, mutlak süresi değil
   * (brief'in kendi ifadesi) — `j1850Pulse.ts`teki "yalnız SOF'a bakmak
   * yetmiyordu" dersi burada ORANLI banda genellenerek uygulanıyor.
   */
  canParse(data: Uint8Array): boolean {
    const decoded = decodePulseLog(data);
    if (!decoded.ok) return false;
    return sentSignatureFromPulses(decoded.result.pulses);
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseSentFrame(data, resolveParseOptions(context));
  },
};

// ── Örnek çerçeveler — CRC hesaplanmadığı için nibble değerleri SERBESTÇE
// seçildi (J1850'nin aksine burada "doğru CRC" diye bir kavram YOK, dosya
// başı CRC kararına bakınız).
//
// ÖLÇÜLDÜ: tick 3 µs (spec özetinin AÇILIŞ örneğiyle, 168 µs = 56×3, örtüşen
// İLK seçim) registry taramasında `sae-j1850-vpw`nin KENDİ canParse'ıyla
// ÇARPIŞTI — düşük tick'te SENT'in nibble süreleri (36-81 µs) ve senkron
// darbesi (168 µs) VPW'nin [32,256]/[64,512] µs bantlarının TAM İÇİNE
// düşüyor (`j1850CanParseRegistry.test.ts` bunu YAKALADI). Bu, SENT'in
// GERÇEK imzasının ("oranlı", `sentSignatureFromPulses`) bir kusuru DEĞİL —
// VPW 14f'te SENT'in varlığından HABERSİZ yazıldığı için kendi MUTLAK
// bandını SENT'in düşük-tick ölçeğiyle paylaşıyor. Örnek verisi (gerçek bir
// yakalama DEĞİL, bu dosyanın kendi icadı) bu belirsizliği taşımak
// ZORUNDA değil — tick 25 µs'ye çekildi: senkron 1400 µs (VPW SOF üst sınırı
// 512'nin ÇOK üstünde), nibble'lar 300-675 µs (VPW veri bandı üst sınırı
// 256'nın ÇOK üstünde) — ikisi de PWM'in ölçeğinden zaten uzak. Spec'in
// KENDİ 3 µs'lik çalışılmış örneği `sent.test.ts`teki fixture testinde AYRICA
// ve DOĞRUDAN sınanıyor (`tickUs: 3` açıkça verilerek), o test BURADAN
// ETKİLENMEZ.
const EXAMPLE_TICK_US = 25;

function nibbleDurationUs(nibbleValue: number, tickUs: number): number {
  return (SENT_NIBBLE_TICKS_MIN + nibbleValue) * tickUs;
}

interface BuildSentPulseLogInput {
  readonly statusNibble: number;
  readonly dataNibbles: readonly number[];
  readonly crcNibble: number;
  readonly tickUs?: number;
  readonly includePause?: boolean;
  readonly pauseDurationUs?: number;
  /** Belirtilen İNDEKSTEKİ (0=sync, 1=status, 2.. = data, sonuncu=CRC) nabzı bandın DIŞINA zorlar — "geçersiz nibble" örneği için. */
  readonly forceOutOfBandPulseIndex?: number;
}

/**
 * `decodePulseLog`in TERSİni (`encodePulseLog`) kullanarak GEÇERLİ bir SENT
 * nabız günlüğü kurar — `j1850Pwm.ts`in `buildPwmPulseLog`iyle AYNI rol.
 */
export function buildSentPulseLog(input: BuildSentPulseLogInput): Uint8Array {
  const tickUs = input.tickUs ?? EXAMPLE_TICK_US;
  const durations: number[] = [SENT_SYNC_TICKS * tickUs, nibbleDurationUs(input.statusNibble, tickUs)];
  input.dataNibbles.forEach((nibble) => durations.push(nibbleDurationUs(nibble, tickUs)));
  durations.push(nibbleDurationUs(input.crcNibble, tickUs));
  if (input.includePause === true) {
    durations.push(input.pauseDurationUs ?? nibbleDurationUs(SENT_MAX_NIBBLE_VALUE, tickUs) * 2);
  }
  if (input.forceOutOfBandPulseIndex !== undefined) {
    const index = input.forceOutOfBandPulseIndex;
    // [12,27] tick bandının KESİN dışında — 30 tick, hiçbir nibble değeriyle eşleşmez.
    durations[index] = 30 * tickUs;
  }
  return encodePulseLog(durations);
}

/** Belirtilen nabız İNDEKSİNİ (0 tabanlı) REZERVE (0x0000) değerine zorlar — `encodePulseLog` rezerveyle çakışmayı önlemek için asla 0 üretmez, bu yüzden sonradan bayt düzeyinde uygulanır. */
export function forceReservedPulse(bytes: Uint8Array, pulseIndex: number): Uint8Array {
  const out = Uint8Array.from(bytes);
  const offset = pulseIndex * PULSE_STRIDE_BYTES;
  out[offset] = 0;
  out[offset + 1] = 0;
  return out;
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'valid-frame',
    name: 'protocol.sent.example.validFrame.name',
    bytes: buildSentPulseLog({ statusNibble: 5, dataNibbles: [1, 10, 15, 3, 7, 2], crcNibble: 9 }),
    description: 'protocol.sent.example.validFrame.description',
    expectedValid: true,
  },
  {
    id: 'with-pause',
    name: 'protocol.sent.example.withPause.name',
    bytes: buildSentPulseLog({
      statusNibble: 0,
      dataNibbles: [0, 0, 0, 0, 0, 0],
      crcNibble: 0,
      includePause: true,
    }),
    description: 'protocol.sent.example.withPause.description',
    expectedValid: true,
  },
  {
    id: 'invalid-nibble',
    name: 'protocol.sent.example.invalidNibble.name',
    bytes: buildSentPulseLog({
      statusNibble: 5,
      dataNibbles: [1, 10, 15, 3, 7, 2],
      crcNibble: 9,
      forceOutOfBandPulseIndex: 4, // 3. data nibble (index: sync=0,status=1,data1=2,data2=3,data3=4).
    }),
    description: 'protocol.sent.example.invalidNibble.description',
    expectedValid: false,
  },
  {
    id: 'truncated',
    name: 'protocol.sent.example.truncated.name',
    // Sync + status + yalnız 2 veri nibble'ı — varsayılan profil 6 istiyor.
    // Süreler EXAMPLE_TICK_US=25 ölçeğinde (yukarıdaki "ÖLÇÜLDÜ" notuyla AYNI
    // gerekçe: VPW'nin bantlarıyla çarpışmaması için).
    bytes: encodePulseLog([1400, 425, 375, 500]),
    description: 'protocol.sent.example.truncated.description',
    expectedValid: false,
  },
];

export const sentPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: sentParser,
  documentation: {
    summary: 'protocol.sent.documentation.summary',
    layer: 'physical',
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
