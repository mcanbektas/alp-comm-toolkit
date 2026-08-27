/**
 * RF Telemetry Custom Frame — Faz 10 dalga 18e. **Deponun SON kanonik kaydı;
 * bu dosyayla `wireless-iot` domain'i ve KATALOG BORCU kapanır.**
 *
 * ## Bu bir PROTOKOL DEĞİL, bir YAPILANDIRILABİLİR ÇERÇEVE MOTORUDUR `[KARAR 18-5]`
 *
 * Yayımlanmış bir tel biçimi YOKTUR — kaydın TANIMI budur. Sayfa, kullanıcının
 * tescilli sub-GHz / 2,4 GHz telemetri çerçevesini BİLDİRDİĞİ parametrelerle
 * çözer. Motor yeniden yazılmadı: `protocol-core`un şema yorumlayıcısı
 * (`schemaParser.ts` + `schemaEncoder.ts`) TÜKETİLİR; emsal
 * `serial/framing/customBinaryProtocol.ts`.
 *
 * ## `createSchemaParser` DOĞRUDAN KULLANILMADI — ve sebebi ÖLÇÜLDÜ
 *
 * **GÜNCELLEME (2026-08-27): aşağıda anlatılan MAYIN KAPANDI, karar DURUYOR.**
 * `schemaParser.ts` `canParse`i boş `startBytes`te artık HER ŞEYE `true`
 * demiyor. Karar bu yüzden yeniden ölçüldü ve DEĞİŞMEDİ: şema tabanlı
 * `canParse` bu kayıtta 12–33 YABANCI isabet alıyor ve kendi 8 örneğinin
 * 2–8'ini kaybediyor (`Data` uzunluğu ÇÖZÜLEN çerçeveden geldiği için tek bir
 * sabit parser örneği auto-detection'a hizmet edemez), elle yazılan imza ise 0
 * yabancı ölçüyor. Ölçümün tamamı `rfTelemetryCanParseRegistry.test.ts` dosya
 * başında. Aşağıdaki paragraf o günün TARİHÇESİDİR:
 *
 * `schemaParser.ts:608` `canParse`i şöyle bitiriyordu:
 * `return startBytes.every((byte, index) => data[index] === byte);`
 * Boş bir dizide `[].every(...)` **`true`** döner, yani `startBytes`siz bir şema
 * registry'deki HER çerçeveyi sahiplenirdi. **O turda ölçüldü: 929 örneğin
 * 929'u (%100).** `length-based-protocol` o gün tam olarak bu durumdaydı.
 *
 * Brifin iki kabul edilebilir çözümünden **İKİNCİSİ** seçildi: şemaya sabit
 * `startBytes` koymak yerine `canParse` BURADA açıkça yazıldı
 * (`hasRfTelemetrySignature`). Gerekçe: önbelleme ve sync sözcüğü bu kayıtta
 * KULLANICI PARAMETRESİDİR; şemaya sabitlenseydi 4 baytlık sync kullanan bir
 * kullanıcı kendi çerçevesini çözemezdi. Auto-detection imzası ise VARSAYILAN
 * PROFİLE sabit kalmalı — iki ihtiyaç ancak ayrıştırılınca birlikte karşılanır.
 *
 * **`schemaParser.ts` DÜZELTİLMEDİ** (18e brifi: *"`length-based-protocol`ın
 * 899/899'u BU DALGADA DÜZELTİLMEZ — ayrı bir kayıt, ayrı bir borç"*). Borç
 * `CLAUDE.md`ye kaydedildi; bu kaydın ondan KAÇINDIĞI
 * `rfTelemetryCanParseRegistry.test.ts`in ikinci ayağında KANITLANIR.
 *
 * ## Spec'in kendi sayısal örnekleri ÇÜRÜDÜ
 *
 * `ozet/09:171`in `C9 21` CRC'si 65.535 polinomun hiçbiriyle,
 * `:173`ün whitening örneği 8.192 LFSR kombinasyonunun hiçbiriyle yeniden
 * üretilemedi. **Alan yerleşimi korundu, sayılar motordan üretildi**
 * (`rfTelemetryProfiles.ts` dosya başı). Burada yayımlanan her CRC
 * `computeChecksum` çağrısının çıktısıdır, brifin verdiği hex DEĞİL.
 *
 * ## Girdi sözleşmesi — ve girdi ADAPTÖRÜ neden kanal değil
 *
 * Girdi **demodüle edilmiş BAYT dizisidir** (önbellemeden CRC'ye kadar).
 * Katalogun "Input Adapters" aracı beş yol sayıyor (demodüle bayt / bit akışı /
 * nabız süresi / logic analyzer ya da SDR dışa aktarımı / UART). Bunlardan
 * yalnız BİRİNCİSİ bağlandı, çünkü ötekiler bir seçenek değil bir GİRDİ
 * DÖNÜŞÜMÜdür: `parse`ın ÖNÜNDE koşarlar ve motorları zaten ayrı dosyalarda
 * duruyor (`bitCursor.ts`, `pulseLog.ts`). Onları buraya `decodeOptions` şıkkı
 * diye asmak, bayt dizisi bekleyen bir fonksiyona "aslında bu nabız listesi"
 * dedirtmek olurdu. Kendi turlarını bekliyorlar.
 *
 * **Manchester ve dewhitening AYNI SINIF dönüşümdür ama BURADA bağlandı** —
 * çünkü ikisi de bayt→bayt çalışır, girdinin TİPİNİ değiştirmez ve çıktıyı
 * bayt bayt değiştirir. Ölçüt buydu.
 *
 * ## KANAL YAPILMAYACAKLAR — gerekçeleriyle
 *
 * *(Dalga 18b dersi: çıktıyı bayt bayt DEĞİŞTİRMEYEN şık kanal değildir.
 * Dalga 18d dersi: `types.ts` kısıtının kapattığı kanal AÇILMAZ, yazılır.)*
 *
 * - **`preambleBytes` / `syncWord` / `whiteningPolynomial` / `whiteningSeed`in
 *   HEX METNİ** — brif dördünü de `text hex` kanalı öngörüyordu.
 *   **AÇILAMADI:** `DecodeOption.kind` yalnız `'select' | 'number'`
 *   (`protocol-core/types.ts:278`) ve o dosya bu dalgada DOKUNULMAZ.
 *   Karşılığı: uzunluklar `number` kanalı oldu (`preambleLength`,
 *   `syncWordLength`), tohum `number` kanalı oldu (`whiteningSeed`), polinom
 *   ise PN9'un tap kümesine SABİTLENDİ. Serbest polinom bir `text` kanalı
 *   ister; `types.ts` genişletilmeden yazılamaz ve bu ayrı bir iştir
 *   (`CLAUDE.md` borcu).
 * - **`profile` (spec / cc1101 / nrf / custom)** — brifin BİRİNCİ kanalı.
 *   **ÇÜRÜDÜ:** belgelenmiş TEK çerçeve yerleşimi spec §3.9'unkidir; CC1101 ve
 *   nRF bir çerçeve yerleşimi değil bir RADYO yapılandırmasıdır (whitening,
 *   Manchester, CRC) ve o üçü zaten AYRI kanaldır. İkinci bir yerleşim
 *   uydurmak, deponun "doğrulanamayanı yayımlama" kuralını çiğnerdi.
 * - **RF metadata** (frekans, modülasyon, veri hızı, sapma, bant genişliği,
 *   RSSI, SNR) — YAKALAMA metadata'sıdır, çerçevede YOKTUR ve çözümü
 *   DEĞİŞTİRMEZ. Katalogun "RF Metadata View" aracı metin listesinde
 *   "planlandı" kalır.
 * - **"Unknown RF Protocol Analyzer"** (sabit baytlar, sayaç adayı, checksum
 *   adayı) — ÇOK ÇERÇEVELİ, çerçeveler arası durum ister (dalga 16 bulgu 12).
 *   Tek-çerçevelik parçası `protocol-core/checksums/checksumFinder.ts`te ZATEN
 *   var ve `/calculators` altında koşuyor.
 * - **`calculatorIds` ile `/calculators` bağlantısı** — brif `lora` emsalini
 *   öneriyordu. **ÇÜRÜDÜ:** `ProtocolPage.tsx:433` bu bağlantıyı YALNIZ
 *   `timing` sekmesinde basıyor, bu kaydın `timing` sekmesi YOK — bağlantı
 *   hiç görünmezdi. Görünmeyen bir bağ, olmayan bir bağdır.
 * - **`custom-schema` tanım paneli** — `[KARAR 18-7]`. Katalogda **19 kayıt**
 *   `definitions: ['custom-schema']` taşıyor ve hepsi "planlandı" basıyor
 *   (`ble-gatt` `ready` olduğu hâlde dahil). Panel 19 kaydı birden ilgilendiren
 *   AYRI bir iştir; domain'i KAPATAN dalgada ikinci bir motor riski artırır
 *   (`[Karar 15h-1]` gerekçesi). Emsal: `lonworks`un `xif`i.
 *
 * ## Ofsetler hangi diziye ait
 *
 * Manchester çözüldüğünde tel iki kat uzundur. `ParsedField.offset/length`
 * DAİMA KULLANICININ YAPIŞTIRDIĞI TEL BAYTLARINA göre verilir (byte-viewer
 * onları vurgular), `rawBytes` da tel dilimidir; ÇÖZÜLMÜŞ değer `rawValue`da
 * durur. Dewhitening uzunluğu değiştirmediği için ofsetler aynen geçerlidir,
 * ama alan değerleri BEYAZLATMASI ÇÖZÜLMÜŞ baytlardan okunur — bu ayrım
 * kullanıcıya bir çerçeve UYARISI olarak bildirilir, sessiz bırakılmaz.
 */

import {
  CHECKSUM_ALGORITHMS,
  checksumToBytes,
  checksumWidthBytes,
  computeChecksum,
} from '@/protocol-core/checksums/algorithmCatalogue';
import type { ChecksumAlgorithm } from '@/protocol-core/checksums/algorithmCatalogue';
import { applyWhitening, PN9_WHITENING } from '@/protocol-core/decoding/lfsrWhitening';
import { decodeManchester, encodeManchester } from '@/protocol-core/decoding/manchester';
import type { ManchesterPolarity } from '@/protocol-core/decoding/manchester';
import { parseWithSchema } from '@/protocol-core/decoding/schemaParser';
import { encodeWithSchema } from '@/protocol-core/encoding/schemaEncoder';
import type { EncodeValues } from '@/protocol-core/encoding/schemaEncoder';
import type { BitOrder } from '@/protocol-core/decoding/bitCursor';
import type { Endianness } from '@/protocol-core/encoding/ieee754';
import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import {
  buildRfTelemetrySchema,
  DEFAULT_CRC_ALGORITHM,
  DEFAULT_LAYOUT,
  DEFAULT_PREAMBLE_LENGTH,
  DEFAULT_SYNC_WORD_LENGTH,
  lengthFieldOffset,
  resolveDataLength,
  SPEC_PREAMBLE_BYTES,
  SPEC_SYNC_WORD_BYTES,
} from './rfTelemetryProfiles';
import type { CrcCoverageStart, LengthFieldSemantics, RfTelemetryLayout } from './rfTelemetryProfiles';

const PROTOCOL_ID = 'rf-telemetry-custom-frame';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'RF Telemetry Custom Frame';

const TRANSLATION_KEY_PREFIX = 'protocol.rfTelemetry';

/**
 * `canParse`ın asgari uzunluğu: 3 önbelleme + 2 sync + 3 header + 2 CRC = 10.
 * Sıfır uzunluklu yük bu sınırda geçerlidir (örnek 6).
 */
const MINIMUM_FRAME_LENGTH = 10;

// ── canParse — ÖLÇÜLMÜŞ imza ve REDDEDİLEN adaylar ───────────────────────

/**
 * Auto-detection imzası: **varsayılan profilin önbellemesi VE sync sözcüğü**,
 * ikisi birden. `decodeOptions` buraya GİRMEZ (`ProtocolParser` sözleşmesi:
 * `canParse` bağlam almaz) — kullanıcı 4 baytlık sync bildirse bile
 * auto-detection varsayılan profili arar.
 *
 * **Ölçüm (bu turda, KODDAN): 147 kayıt / 929 örnek → 0 yabancı çakışma.**
 */
export function hasRfTelemetrySignature(data: Uint8Array): boolean {
  if (data.length < MINIMUM_FRAME_LENGTH) return false;
  for (let index = 0; index < SPEC_PREAMBLE_BYTES.length; index += 1) {
    if (data[index] !== SPEC_PREAMBLE_BYTES[index]) return false;
  }
  for (let index = 0; index < SPEC_SYNC_WORD_BYTES.length; index += 1) {
    if (data[SPEC_PREAMBLE_BYTES.length + index] !== SPEC_SYNC_WORD_BYTES[index]) return false;
  }
  return true;
}

/**
 * REDDEDİLEN aday 1 — yalnız önbelleme (`AA AA AA`). Bekçi testi bunu da
 * ölçer ki "sync ayağı gereksizdi" iddiası bir gün SAYIYLA yanıtlanabilsin.
 */
export function hasPreambleOnlySignature(data: Uint8Array): boolean {
  if (data.length < MINIMUM_FRAME_LENGTH) return false;
  return SPEC_PREAMBLE_BYTES.every((byte, index) => data[index] === byte);
}

/** REDDEDİLEN aday 2 — sync sözcüğünü ilk 12 baytta ARAYAN gevşek imza. */
export function hasSyncWordScanSignature(data: Uint8Array): boolean {
  const limit = Math.min(data.length, 12);
  for (let index = 0; index + 1 < limit; index += 1) {
    if (data[index] === SPEC_SYNC_WORD_BYTES[0] && data[index + 1] === SPEC_SYNC_WORD_BYTES[1]) {
      return true;
    }
  }
  return false;
}

// ── decodeOptions — ON kanal, hepsi ÇIKTIYI BAYT DÜZEYİNDE değiştirir ─────

const OPTION_MANCHESTER_POLARITY = 'manchesterPolarity';
const OPTION_MANCHESTER_BIT_ORDER = 'manchesterBitOrder';
const OPTION_WHITENING = 'whitening';
const OPTION_WHITENING_SEED = 'whiteningSeed';
const OPTION_PREAMBLE_LENGTH = 'preambleLength';
const OPTION_SYNC_WORD_LENGTH = 'syncWordLength';
const OPTION_LENGTH_SEMANTICS = 'lengthFieldSemantics';
const OPTION_CRC_ALGORITHM = 'crcAlgorithm';
const OPTION_CRC_COVERAGE = 'crcCoverage';
const OPTION_CRC_BYTE_ORDER = 'crcByteOrder';

const MANCHESTER_NONE = 'none';
const WHITENING_NONE = 'none';
const WHITENING_PN9 = 'pn9';

/** PN9 dokuz bitliktir; tohum 1..511. Sıfır tohum sonsuz sıfır dizisi üretir. */
const WHITENING_SEED_MIN = 1;
const WHITENING_SEED_MAX = 0x1ff;

const CRC_COVERAGE_CHOICES: readonly CrcCoverageStart[] = [
  'syncWord',
  'deviceId',
  'packetType',
  'length',
  'data',
];

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_MANCHESTER_POLARITY,
    label: `${TRANSLATION_KEY_PREFIX}.option.manchesterPolarity`,
    kind: 'select',
    defaultValue: MANCHESTER_NONE,
    description: `${TRANSLATION_KEY_PREFIX}.option.manchesterPolarity.description`,
    choices: [
      { value: MANCHESTER_NONE, label: `${TRANSLATION_KEY_PREFIX}.option.manchesterPolarity.none` },
      // Gelenek adları VERİDİR, çevrilmez.
      { value: 'ieee802.3', label: 'IEEE 802.3' },
      { value: 'thomas', label: 'G. E. Thomas' },
    ],
  },
  {
    id: OPTION_MANCHESTER_BIT_ORDER,
    label: `${TRANSLATION_KEY_PREFIX}.option.manchesterBitOrder`,
    kind: 'select',
    defaultValue: 'msb-first',
    description: `${TRANSLATION_KEY_PREFIX}.option.manchesterBitOrder.description`,
    choices: [
      { value: 'msb-first', label: 'MSB-first' },
      { value: 'lsb-first', label: 'LSB-first' },
    ],
  },
  {
    id: OPTION_WHITENING,
    label: `${TRANSLATION_KEY_PREFIX}.option.whitening`,
    kind: 'select',
    defaultValue: WHITENING_NONE,
    description: `${TRANSLATION_KEY_PREFIX}.option.whitening.description`,
    choices: [
      { value: WHITENING_NONE, label: `${TRANSLATION_KEY_PREFIX}.option.whitening.none` },
      // Tap kümesinin adı VERİDİR: PN9 = x⁹ + x⁵ + 1 (TI CC1101/CC2500).
      { value: WHITENING_PN9, label: 'PN9 (x^9 + x^5 + 1)' },
    ],
  },
  {
    id: OPTION_WHITENING_SEED,
    label: `${TRANSLATION_KEY_PREFIX}.option.whiteningSeed`,
    kind: 'number',
    min: WHITENING_SEED_MIN,
    max: WHITENING_SEED_MAX,
    defaultValue: WHITENING_SEED_MAX,
    description: `${TRANSLATION_KEY_PREFIX}.option.whiteningSeed.description`,
  },
  {
    id: OPTION_PREAMBLE_LENGTH,
    label: `${TRANSLATION_KEY_PREFIX}.option.preambleLength`,
    kind: 'number',
    min: 0,
    max: 8,
    defaultValue: DEFAULT_PREAMBLE_LENGTH,
    description: `${TRANSLATION_KEY_PREFIX}.option.preambleLength.description`,
  },
  {
    id: OPTION_SYNC_WORD_LENGTH,
    label: `${TRANSLATION_KEY_PREFIX}.option.syncWordLength`,
    kind: 'number',
    min: 0,
    max: 4,
    defaultValue: DEFAULT_SYNC_WORD_LENGTH,
    description: `${TRANSLATION_KEY_PREFIX}.option.syncWordLength.description`,
  },
  {
    id: OPTION_LENGTH_SEMANTICS,
    label: `${TRANSLATION_KEY_PREFIX}.option.lengthFieldSemantics`,
    kind: 'select',
    defaultValue: 'payload-only',
    description: `${TRANSLATION_KEY_PREFIX}.option.lengthFieldSemantics.description`,
    choices: [
      {
        value: 'payload-only',
        label: `${TRANSLATION_KEY_PREFIX}.option.lengthFieldSemantics.payloadOnly`,
      },
      {
        value: 'includes-crc',
        label: `${TRANSLATION_KEY_PREFIX}.option.lengthFieldSemantics.includesCrc`,
      },
      {
        value: 'includes-header',
        label: `${TRANSLATION_KEY_PREFIX}.option.lengthFieldSemantics.includesHeader`,
      },
    ],
  },
  {
    id: OPTION_CRC_ALGORITHM,
    label: `${TRANSLATION_KEY_PREFIX}.option.crcAlgorithm`,
    kind: 'select',
    defaultValue: DEFAULT_CRC_ALGORITHM,
    description: `${TRANSLATION_KEY_PREFIX}.option.crcAlgorithm.description`,
    // Şıklar KATALOGDAN türetilir, elle yazılmaz: `protocolSchema.ts`in
    // `algorithm` alanı `CHECKSUM_ALGORITHMS`e bağlı ve listeye bir gün bir
    // algoritma eklenirse bu kanal onu KENDİLİĞİNDEN sunar.
    // 🚨 Brif "38 katalog girdisi" diyordu; şemanın kabul ettiği küme
    // `crcCatalogue.ts`in 38'i DEĞİL, `algorithmCatalogue.ts`in
    // CHECKSUM_ALGORITHMS listesidir (basit toplamlar dahil).
    choices: CHECKSUM_ALGORITHMS.map((algorithm) => ({
      // Algoritma adları VERİDİR, çevrilmez.
      value: algorithm,
      label: algorithm,
    })),
  },
  {
    id: OPTION_CRC_COVERAGE,
    label: `${TRANSLATION_KEY_PREFIX}.option.crcCoverage`,
    kind: 'select',
    defaultValue: DEFAULT_LAYOUT.crcCoverageStart,
    description: `${TRANSLATION_KEY_PREFIX}.option.crcCoverage.description`,
    // Alan adları VERİDİR, çevrilmez — şemadaki `id`lerin birebir aynısı.
    choices: CRC_COVERAGE_CHOICES.map((field) => ({ value: field, label: `${field} … data` })),
  },
  {
    id: OPTION_CRC_BYTE_ORDER,
    label: `${TRANSLATION_KEY_PREFIX}.option.crcByteOrder`,
    kind: 'select',
    defaultValue: 'big',
    description: `${TRANSLATION_KEY_PREFIX}.option.crcByteOrder.description`,
    choices: [
      { value: 'big', label: `${TRANSLATION_KEY_PREFIX}.option.crcByteOrder.big` },
      { value: 'little', label: `${TRANSLATION_KEY_PREFIX}.option.crcByteOrder.little` },
    ],
  },
];

// ── Hata ve uyarı anahtarları ────────────────────────────────────────────

const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_MANCHESTER_INVALID_PAIR = `${TRANSLATION_KEY_PREFIX}.error.manchesterInvalidPair`;
const ERROR_MANCHESTER_ODD_LENGTH = `${TRANSLATION_KEY_PREFIX}.error.manchesterOddLength`;
const ERROR_HEADER_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.headerTruncated`;
const ERROR_LENGTH_SEMANTICS = `${TRANSLATION_KEY_PREFIX}.error.lengthSemantics`;

const WARN_PREAMBLE_MISMATCH = `${TRANSLATION_KEY_PREFIX}.warning.preambleMismatch`;
const WARN_SYNC_WORD_MISMATCH = `${TRANSLATION_KEY_PREFIX}.warning.syncWordMismatch`;
const WARN_DEWHITENED_VIEW = `${TRANSLATION_KEY_PREFIX}.warning.dewhitenedView`;
const WARN_MANCHESTER_VIEW = `${TRANSLATION_KEY_PREFIX}.warning.manchesterView`;
const WARN_USER_DECLARED_PROFILE = `${TRANSLATION_KEY_PREFIX}.warning.userDeclaredProfile`;

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

// ── Seçenek okuma ────────────────────────────────────────────────────────

function readSelect(options: Record<string, unknown> | undefined, optionId: string, fallback: string): string {
  const raw = options?.[optionId];
  if (typeof raw !== 'string') return fallback;
  const option = DECODE_OPTIONS.find((candidate) => candidate.id === optionId);
  return option?.choices?.some((choice) => choice.value === raw) === true ? raw : fallback;
}

function readNumber(
  options: Record<string, unknown> | undefined,
  optionId: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = options?.[optionId];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    return fallback;
  }
  return value;
}

interface RfTelemetryOptions {
  readonly layout: RfTelemetryLayout;
  readonly manchesterPolarity: ManchesterPolarity | 'none';
  readonly manchesterBitOrder: BitOrder;
  readonly whiteningEnabled: boolean;
  readonly whiteningSeed: number;
}

function readOptions(options: Record<string, unknown> | undefined): RfTelemetryOptions {
  const manchesterPolarity = readSelect(
    options,
    OPTION_MANCHESTER_POLARITY,
    MANCHESTER_NONE,
  ) as ManchesterPolarity | 'none';

  return {
    layout: {
      preambleLength: readNumber(options, OPTION_PREAMBLE_LENGTH, DEFAULT_PREAMBLE_LENGTH, 0, 8),
      syncWordLength: readNumber(options, OPTION_SYNC_WORD_LENGTH, DEFAULT_SYNC_WORD_LENGTH, 0, 4),
      lengthSemantics: readSelect(
        options,
        OPTION_LENGTH_SEMANTICS,
        DEFAULT_LAYOUT.lengthSemantics,
      ) as LengthFieldSemantics,
      crcAlgorithm: readSelect(
        options,
        OPTION_CRC_ALGORITHM,
        DEFAULT_CRC_ALGORITHM,
      ) as ChecksumAlgorithm,
      crcCoverageStart: readSelect(
        options,
        OPTION_CRC_COVERAGE,
        DEFAULT_LAYOUT.crcCoverageStart,
      ) as CrcCoverageStart,
      crcByteOrder: readSelect(options, OPTION_CRC_BYTE_ORDER, DEFAULT_LAYOUT.crcByteOrder) as Endianness,
    },
    manchesterPolarity,
    manchesterBitOrder: readSelect(options, OPTION_MANCHESTER_BIT_ORDER, 'msb-first') as BitOrder,
    whiteningEnabled: readSelect(options, OPTION_WHITENING, WHITENING_NONE) === WHITENING_PN9,
    whiteningSeed: readNumber(
      options,
      OPTION_WHITENING_SEED,
      WHITENING_SEED_MAX,
      WHITENING_SEED_MIN,
      WHITENING_SEED_MAX,
    ),
  };
}

// ── Girdi dönüşümleri: Manchester → dewhitening → şema ───────────────────

function failure(error: ProtocolError, consumedBytes = 0): ParseResult {
  return { success: false, error, consumedBytes, recoverable: true };
}

/**
 * Alanları TEL ofsetlerine geri haritalar. Manchester'da her çözülmüş bayt tam
 * iki tel baytına karşılık geldiği için eşleme kesindir; `rawBytes` tel
 * dilimine çevrilir ki byte-viewer'ın vurguladığı baytlarla alan tablosundaki
 * baytlar AYNI şey olsun.
 */
function scaleFieldsToWire(fields: ParsedField[], wire: Uint8Array): ParsedField[] {
  return fields.map((field) => {
    const offset = field.offset * 2;
    const length = field.length * 2;
    return {
      ...field,
      offset,
      length,
      rawBytes: wire.subarray(offset, Math.min(offset + length, wire.length)),
    };
  });
}

function parseRfTelemetry(data: Uint8Array, context?: ParseContext): ParseResult {
  if (data.length === 0) {
    return failure({ code: 'truncated-frame', message: ERROR_EMPTY_FRAME, offset: 0, length: 0 });
  }

  const settings = readOptions(context?.options);
  const warnings: ProtocolWarning[] = [toProtocolWarning(WARN_USER_DECLARED_PROFILE)];

  // 1) Manchester — telin İKİ katı bit taşıdığı yer. `parse`ın ÖNÜNDE koşar.
  let working = data;
  let manchesterApplied = false;
  if (settings.manchesterPolarity !== MANCHESTER_NONE) {
    const decoded = decodeManchester(
      data,
      settings.manchesterPolarity,
      settings.manchesterBitOrder,
    );
    if (!decoded.success) {
      return failure({
        code: 'unsupported-encoding',
        message: decoded.error.pair < 0 ? ERROR_MANCHESTER_ODD_LENGTH : ERROR_MANCHESTER_INVALID_PAIR,
        offset: decoded.error.wireOffset,
        length: 1,
        details: { bitPairIndex: decoded.error.bitPairIndex, pair: decoded.error.pair },
      });
    }
    working = decoded.bytes;
    manchesterApplied = true;
    warnings.push(toProtocolWarning(WARN_MANCHESTER_VIEW));
  }

  const headerSkip = settings.layout.preambleLength + settings.layout.syncWordLength;

  // 2) Dewhitening — önbelleme ve sync BEYAZLATILMAZ: alıcı senkronizasyonu
  //    onlara dayanır, beyazlatılsalardı bulunamazlardı.
  if (settings.whiteningEnabled && working.length > headerSkip) {
    const body = applyWhitening(
      working.subarray(headerSkip),
      { ...PN9_WHITENING, seed: settings.whiteningSeed },
      'lsb-first',
    );
    const merged = new Uint8Array(working.length);
    merged.set(working.subarray(0, headerSkip), 0);
    merged.set(body, headerSkip);
    working = merged;
    warnings.push(toProtocolWarning(WARN_DEWHITENED_VIEW));
  }

  // 3) `Length` baytı — şema ancak yorum uygulandıktan sonra kurulabilir.
  const lengthOffset = lengthFieldOffset(settings.layout);
  if (working.length <= lengthOffset) {
    return failure(
      {
        code: 'truncated-frame',
        message: ERROR_HEADER_TRUNCATED,
        offset: Math.min(working.length, lengthOffset) * (manchesterApplied ? 2 : 1),
      },
      data.length,
    );
  }
  const rawLength = working[lengthOffset] ?? 0;
  const resolution = resolveDataLength(rawLength, settings.layout);
  if (resolution.issue !== undefined) {
    return failure(
      {
        code: 'length-mismatch',
        message: ERROR_LENGTH_SEMANTICS,
        offset: lengthOffset * (manchesterApplied ? 2 : 1),
        length: manchesterApplied ? 2 : 1,
        details: { rawLength, semantics: settings.layout.lengthSemantics },
      },
      data.length,
    );
  }

  // 4) Şema motoru — `createSchemaParser` DEĞİL, `parseWithSchema` doğrudan.
  const schema = buildRfTelemetrySchema(settings.layout, resolution.dataLength);
  const result = parseWithSchema(schema, working, context === undefined ? {} : { context });

  if (!result.success) {
    return {
      ...result,
      error: {
        ...result.error,
        ...(result.error.offset === undefined || !manchesterApplied
          ? {}
          : { offset: result.error.offset * 2 }),
      },
      consumedBytes: result.consumedBytes * (manchesterApplied ? 2 : 1),
    };
  }

  // 5) Varsayılan profilden SAPMA bir hata değil, bir uyarıdır.
  if (settings.layout.preambleLength === DEFAULT_PREAMBLE_LENGTH) {
    const matches = SPEC_PREAMBLE_BYTES.every((byte, index) => working[index] === byte);
    if (!matches) warnings.push(toProtocolWarning(WARN_PREAMBLE_MISMATCH));
  }
  if (settings.layout.syncWordLength === DEFAULT_SYNC_WORD_LENGTH) {
    const matches = SPEC_SYNC_WORD_BYTES.every(
      (byte, index) => working[settings.layout.preambleLength + index] === byte,
    );
    if (!matches) warnings.push(toProtocolWarning(WARN_SYNC_WORD_MISMATCH));
  }

  const fields = manchesterApplied
    ? scaleFieldsToWire(result.frame.fields, data)
    : result.frame.fields;

  return {
    success: true,
    consumedBytes: data.length,
    frame: {
      ...result.frame,
      protocol: PROTOCOL_ID,
      rawFrame: createRawFrame(data, {
        ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
        ...(context?.direction === undefined ? {} : { direction: context.direction }),
        ...(context?.channel === undefined ? {} : { channel: context.channel }),
      }),
      fields,
      errors: manchesterApplied
        ? result.frame.errors.map((error) => ({
            ...error,
            ...(error.offset === undefined ? {} : { offset: error.offset * 2 }),
            ...(error.length === undefined ? {} : { length: error.length * 2 }),
          }))
        : result.frame.errors,
      warnings: [...warnings, ...result.frame.warnings],
    },
  };
}

export const rfTelemetryParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,
  canParse: hasRfTelemetrySignature,
  parse: parseRfTelemetry,
};

// ── `build` sekmesi — dört wireless-iot kaydının TEK encoder'ı ────────────

/**
 * `Data` uzunluğu `lengthFrom: 'length'` ile bağlandığında `encodeWithSchema`
 * `Length` alanını KENDİ hesaplar (`payload-only` yorumu) ve CRC'yi de kendi
 * doldurur — kullanıcıdan istenmez (spec §10). Emsal
 * `customBinaryProtocol.ts:36-42`, hata yolu dahil.
 */
export function encodeRfTelemetryFrame(values: EncodeValues): Uint8Array {
  const schema = buildRfTelemetrySchema(DEFAULT_LAYOUT, undefined);
  const merged: EncodeValues = {
    preamble: Uint8Array.from(SPEC_PREAMBLE_BYTES),
    syncWord: Uint8Array.from(SPEC_SYNC_WORD_BYTES),
    ...values,
  };
  const result = encodeWithSchema(schema, merged);
  if (!result.success) {
    throw new Error(`encodeRfTelemetryFrame: ${result.issues.map((issue) => issue.message).join('; ')}`);
  }
  return result.bytes;
}

// ── Örnek çerçeveler — CRC'ler MOTORDAN, brifin hex'inden DEĞİL ───────────

/**
 * Varsayılan profilde bir çerçeve kurar ve CRC'yi `computeChecksum` ile
 * HESAPLAR. Elle hex yazmak, spec'in `C9 21`iyle aynı hataya düşme yolu olurdu.
 */
function buildFrame(
  deviceId: number,
  packetType: number,
  lengthByte: number,
  data: readonly number[],
  algorithm: ChecksumAlgorithm = DEFAULT_CRC_ALGORITHM,
  byteOrder: Endianness = 'big',
): Uint8Array {
  const header = [deviceId, packetType, lengthByte, ...data];
  const width = checksumWidthBytes(algorithm);
  const computed = computeChecksum(Uint8Array.from(header), algorithm) ?? 0n;
  return Uint8Array.from([
    ...SPEC_PREAMBLE_BYTES,
    ...SPEC_SYNC_WORD_BYTES,
    ...header,
    ...checksumToBytes(computed, width, byteOrder),
  ]);
}

const PAYLOAD = [0x34, 0x12, 0x78, 0x56];

/** 1 — spec §3.9 yerleşimi, CRC-16/CCITT-FALSE, big-endian. */
const DEFAULT_PROFILE_FRAME = buildFrame(0x01, 0x14, PAYLOAD.length, PAYLOAD);

/** 2 — aynı çerçeve, gövdesi PN9 (tohum 0x1FF) ile beyazlatılmış. */
const WHITENED_FRAME = (() => {
  const headerSkip = SPEC_PREAMBLE_BYTES.length + SPEC_SYNC_WORD_BYTES.length;
  const out = Uint8Array.from(DEFAULT_PROFILE_FRAME);
  out.set(applyWhitening(DEFAULT_PROFILE_FRAME.subarray(headerSkip), PN9_WHITENING), headerSkip);
  return out;
})();

/** 3 — aynı çerçeve, TAMAMI Manchester (IEEE 802.3) ile kodlanmış: 28 bayt. */
const MANCHESTER_FRAME = encodeManchester(DEFAULT_PROFILE_FRAME, 'ieee802.3');

/** 4 — 1'in son CRC baytı bozuk. */
const CRC_MISMATCH_FRAME = (() => {
  const out = Uint8Array.from(DEFAULT_PROFILE_FRAME);
  out[out.length - 1] = 0x55;
  return out;
})();

/** 5 — `Length = 0xFF` ama tel yalnız 4 baytlık yük taşıyor. */
const LENGTH_OVERFLOW_FRAME = (() => {
  const out = Uint8Array.from(DEFAULT_PROFILE_FRAME);
  out[7] = 0xff;
  return out;
})();

/** 6 — sıfır uzunluklu yük: `Length = 0`, `Data` yok, CRC hemen gelir. */
const ZERO_LENGTH_FRAME = buildFrame(0x01, 0x14, 0, []);

/** 7 — aynı gövde, `CRC16_MODBUS` ve LITTLE-endian saklama. */
const MODBUS_CRC_FRAME = buildFrame(
  0x01,
  0x14,
  PAYLOAD.length,
  PAYLOAD,
  'CRC16_MODBUS',
  'little',
);

/** 8 — `Length` CRC'yi de sayıyor (`06`); varsayılan yorumla ÇÖZÜLEMEZ. */
const LENGTH_INCLUDES_CRC_FRAME = buildFrame(0x01, 0x14, PAYLOAD.length + 2, PAYLOAD);

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'default-profile',
    name: `${TRANSLATION_KEY_PREFIX}.example.defaultProfile.name`,
    bytes: DEFAULT_PROFILE_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.defaultProfile.description`,
    expectedValid: true,
  },
  {
    id: 'whitened',
    name: `${TRANSLATION_KEY_PREFIX}.example.whitened.name`,
    bytes: WHITENED_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.whitened.description`,
    // Varsayılan seçeneklerle beyazlatma KAPALI: gövde anlamsız okunur ve CRC
    // tutmaz. `whitening = PN9` seçilince 1 ile AYNI alanlara dönüşür.
    expectedValid: false,
  },
  {
    id: 'manchester',
    name: `${TRANSLATION_KEY_PREFIX}.example.manchester.name`,
    bytes: MANCHESTER_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.manchester.description`,
    expectedValid: false,
  },
  {
    id: 'crc-mismatch',
    name: `${TRANSLATION_KEY_PREFIX}.example.crcMismatch.name`,
    bytes: CRC_MISMATCH_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.crcMismatch.description`,
    expectedValid: false,
  },
  {
    id: 'length-overflow',
    name: `${TRANSLATION_KEY_PREFIX}.example.lengthOverflow.name`,
    bytes: LENGTH_OVERFLOW_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.lengthOverflow.description`,
    expectedValid: false,
  },
  {
    id: 'zero-length-payload',
    name: `${TRANSLATION_KEY_PREFIX}.example.zeroLengthPayload.name`,
    bytes: ZERO_LENGTH_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.zeroLengthPayload.description`,
    expectedValid: true,
  },
  {
    id: 'modbus-crc',
    name: `${TRANSLATION_KEY_PREFIX}.example.modbusCrc.name`,
    bytes: MODBUS_CRC_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.modbusCrc.description`,
    expectedValid: false,
  },
  {
    id: 'length-includes-crc',
    name: `${TRANSLATION_KEY_PREFIX}.example.lengthIncludesCrc.name`,
    bytes: LENGTH_INCLUDES_CRC_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.lengthIncludesCrc.description`,
    expectedValid: false,
  },
];

export const rfTelemetryExampleFrames = EXAMPLE_FRAMES;

export const rfTelemetryPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'wireless-iot',
  parser: rfTelemetryParser,
  encoder: { encode: (message) => encodeRfTelemetryFrame(message as EncodeValues) },
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
