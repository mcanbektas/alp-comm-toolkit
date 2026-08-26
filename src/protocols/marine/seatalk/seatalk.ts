/**
 * SeaTalk 1 — Raymarine'in üç telli eski enstrüman veri yolu (Faz 10, dalga 16b).
 *
 * ── HİÇBİR PAYLAŞILAN ÇEKİRDEK TÜKETİLMEZ, VE BU BİLİNÇLİ ──────────────────
 * `nmeaChecksum.ts` (SeaTalk ASCII değil, `$`/`*` sınırlayıcısı yok),
 * `hdlcCore.ts` (bayrak/bit-stuffing yok), `canFrame.ts` (CAN değil),
 * `bitCursor.ts` (bit-hizasız alan yok) — hiçbiri kullanılmadı. Bu bir eksiklik
 * değil, protokolün kendisidir: SeaTalk 1'in NMEA ile ORTAK TELİ YOKTUR.
 * Katalogdaki tek `related` bağı (`nmea-2000`) SEMANTİKtir (gateway dönüşümü),
 * tel değil. Paylaşım aramak `ccp.ts`in REDDETTİĞİ şeydir (benzer görünen ama
 * çekirdeği ortak OLMAYAN iki kaydı birleştirmek).
 *
 * ── KOMUT BİTİ ÇERÇEVEDE YOKTUR — BU DOSYANIN EN İNCELİKLİ NOKTASI ─────────
 * Knauf, *SeaTalk Technical Reference* Part 1 §Serial Data Transmission,
 * birebir: *"11 bits are transmitted for each character: 1 Start bit (0V) /
 * 8 Data Bits (least significant bit transmitted first) / **1 Command bit, set
 * on the first character of each datagram. Reflected in the parity bit of most
 * UARTs.** / 1 Stop bit (+12V)"*.
 *
 * Yani **datagram sınırını belirleyen bit baytların İÇİNDE DEĞİLDİR** — 4800
 * baud'da 1 start + 9 veri + 1 stop = 11 bit/karakter ve dokuzuncu bit
 * `Uint8Array`de YER ALMAZ. Knauf'un kendi DOS monitörü (Part 3) bir 16550'yi
 * `LCR = 0x3B` ile programlıyor: `UART_LCR_WLEN8|UART_LCR_PARITY|UART_LCR_EPAR|
 * UART_LCR_SPAR` (Linux `include/uapi/linux/serial_reg.h:110-119`) — stick
 * parity SPACE, yani parity biti sabit 0 beklenir; komut baytı dokuzuncu bitini
 * 1 taşıdığı için parity UYUŞMAZ ve `UART_LSR_PE = 0x04` kalkar. Monitördeki
 * `if (line_status_reg & 4)` testi tam olarak budur: **"parity hatası" bayrağı
 * KOMUT BİTİ göstergesidir.** Gerçek alternatifler: AVR 9-bit UART
 * (`SeaTalkNMEA/HardwareSerial.h:82`, `SERIAL_9N1 0x86`) ve Pi bit-bang
 * (`STALK_read.py:30`, `bb_serial_read_open(gpio, 4800, 9)`).
 *
 * Bu, `mil-std-1553`ün *"sözcük tipi çerçevede YOK"* bulgusunun (15g) ve
 * `io-link`in `messageSide`inin (13h) birebir sınıfıdır. Sonucu:
 *   - `commandByteSource` seçeneği açılır (`assumeFirstByte` varsayılan;
 *     `lengthChained` zinciri doğrular),
 *   - komut baytı alan tablosunda **`Command (assumed)`** adını taşır,
 *   - ve HER çözümde KOŞULSUZ `commandBitNotInBytes` uyarısı basılır.
 * Gerekçe `mode-s`in DF0/4/5'te CRC PASS/FAIL alanını HİÇ BASMAMASI (15h) ile
 * aynı ailedendir: burada ölçüm VAR ama VARSAYIMA dayalı ve bu görünür olmalı.
 *
 * ── SEATALK 1'DE CHECKSUM YOKTUR — ARANARAK DOĞRULANDI ─────────────────────
 * Knauf Part 1/2/3'ün TAM metninde `checksum`/`Checksum`/`CRC`/`crc` araması
 * SIFIR sonuç veriyor (bu dalgada sayfalar indirilip yeniden arandı, sonuç
 * aynı). Belgelenen tek iki bütünlük mekanizması:
 *   1. **Tümleyen-çift artıklığı**, YALNIZ bazı komutlarda — Part 1 §Data
 *      Coding: *"Some characters are repeated with all bits inverted… Example:
 *      0xA2 is followed by 0x5D. The sum of both bytes must always be 0xFF."*
 *      Knauf bunu küçük harfle gösteriyor (`ZZ zz`); tablo
 *      `seatalkCommands.ts`teki `complementPairs`tir ve **tanımlı OLMAYAN
 *      komutta alan HİÇ BASILMAZ** (uydurma doğrulama üretmemek).
 *   2. **Uzunluk uyuşmazlığı = at** — Part 1 §Collision Management: *"messages
 *      which are shorter than expected are invalid and have to be cancelled
 *      totally."* Doğrulayıcı: `SeaTalkNMEA.ino` bir datagramı yalnız
 *      `packetLength == bi` ile kabul ediyor, checksum yolu KODDA YOK.
 * Bu yüzden motor bir checksum ALANI BASMAZ, katalog `crcCatalogue.ts`e tek
 * satır eklenmez ve HER çözümde `noIntegrityCheckOnWire` uyarısı basılır:
 * "doğrulanmış çerçeve" güvencesi VERİLEMEZ (dalga 13 dersi 3).
 *
 * ── TUZAK: `$STALK`IN `*CS`İ SEATALK'IN DEĞİLDİR ──────────────────────────
 * SignalK SeaTalk'u `$STALK,xx,yy,nn*CS` sarmalıyla taşıyor
 * (`nmea0183-signalk/src/hooks/ALK.ts`) ve o `*CS` **NMEA 0183'ün XOR
 * checksum'ıdır** — sarmalın, SeaTalk'un değil. Bunu görüp "SeaTalk'un
 * checksum'ı var" sonucuna varmak yanlıştır; aksine yerlisi OLMADIĞININ
 * kanıtıdır. Bu motorun girdisi `$STALK` cümlesi DEĞİL, **ham datagram
 * baytlarıdır**; `$STALK` bir KONTEYNER biçimidir (`mode-s`in Beast/SBS
 * konteynerleri gibi, 15h) ve KAPSAM DIŞIDIR.
 *
 * ── ATTRIBUTE'IN YÜKSEK NIBBLE'I VERİDİR, DOLGU DEĞİL ─────────────────────
 * Part 1 §Composition of Messages: *"Attribute Character, specifying the total
 * length of the datagram in the least significant nibble: Most significant 4
 * bits: **0 or part of a data value**"*. `data[1]`i tümüyle "length" diye
 * adlandırmak YANLIŞTIR — alan `Attribute` adını alır, düşük nibble ayrı bir
 * `Attribute · Additional Byte Count` alanı, yüksek nibble ayrı bir
 * `Attribute · Data Nibble` alanı olarak basılır. `25`in toplam sayacı, `53`ün
 * kursu, `84`/`9C`in başlığı ve `54`ün saniyesi o nibble'ı GERÇEKTEN kullanır.
 * Toplam uzunluk: **`3 + (data[1] & 0x0F)`**, 3–18 bayt. Üç bağımsız yerde
 * doğrulandı: Knauf'un monitörü (`byte_ctr = (receiver_buf & 0xF) + 2`),
 * `SeaTalkNMEA.ino:1740` (`packetLength = 3 + (v & 0x0f)`) ve Part 2'nin
 * her satırı.
 *
 * ── HANGİ KOMUTUN PAYLOAD'I ÇÖZÜLÜR — VE NEDEN YALNIZ ONLARIN ─────────────
 * **59 TANINIR / 22 ÇÖZÜLÜR.** Ayrıntılı gerekçe, çift-kaynak ölçütü, üç
 * kaynak çelişkisi vakası ve `C7`nin neden fantom bir komut olduğu
 * `seatalkCommands.ts` dosya başındadır. Özet: Knauf'un komut ADLARI
 * güvenilirdir (bir isim listesidir), ama payload'ın BİT AYRINTISI ikinci bir
 * bağımsız uygulamada teyit edilmeden ADLANDIRILMAZ — `ads-b`nin Type Code
 * kararının (15h) birebir biçimi. Teyitsiz komutta payload HAM kalır +
 * `commandPayloadNeedsVendorMap`. **Tek kaynaklı komutun alan tablosu
 * YAYINLANMAZ.**
 *
 * ── BAŞLIK FORMÜLÜ SADELEŞTİRİLEMEZ ───────────────────────────────────────
 * `84`/`9C`: `(U & 0x3)*90 + (VW & 0x3F)*2 + <U'nun iki üst bitinde SET olan
 * bit sayısı>`; `53`/`89`: `(U & 0x3)*90 + (VW & 0x3F)*2 + (U & 0xC)/8`.
 * İKİSİ AYNI DEĞİLDİR ve `(U & 0x3)*90 + VW/2` gibi bir sadeleştirme HATA
 * VERMEDEN yanlış açı üretir (`arinc-429`in bit sırası tuzağıyla aynı sınıf,
 * 15f). Formüller `seatalkCommands.ts`te birebir yazılı ve testli.
 *
 * ── `canParse` DAİMA `false` — VE BU ÖLÇÜLMÜŞ BİR KARARDIR ────────────────
 * SeaTalk'ta sihirli sayı YOK, checksum YOK, sınırlayıcı YOK, adres YOK
 * (Part 1: *"No datagrams or devices carry addresses"*). Geriye tek sinyal
 * kalıyor: `3 ≤ n ≤ 18 && n === 3 + (data[1] & 0x0F)`. Ana brif bu imzayı TAM
 * registry üzerinde ÖLÇTÜ (2026-08-26): naif hâlinde **27/870 (%3.1)**,
 * `data[0]` Knauf'un komut kümesiyle daraltıldığında bile **7/870 (%0.8)** —
 * ve 870 örneğin %57.6'sı zaten 3–18 bayt aralığında, yani SeaTalk'un imza
 * uzayı deponun EN KALABALIK bölgesidir.
 *
 * `uavcanCompatibility.ts` (15b) emsali geçerli ama **SEBEP FARKLI**: orada
 * kaydın kendi teli YOKTU; burada tel VAR, sorun baytlarda **AYIRT EDİCİ
 * SİNYAL OLMAMASIDIR** — datagram sınırını belirleyen dokuzuncu bit çerçevenin
 * dışında. İmza ne kadar daraltılırsa daraltılsın yanlış pozitif sıfırlanmıyor.
 * `true` dönmek registry'nin aday listesini çöpe çevirirdi; kullanıcı bu
 * sayfayı AÇIKÇA seçer. Bekçi: `seatalkCanParseRegistry.test.ts` — ölçümü
 * kodda TEKRARLAR ve çakışma sayısının `> 0` kaldığını ASSERT eder.
 *
 * ── SEATALKNG = NMEA 2000, AYRI BİR PROTOKOL DEĞİL ────────────────────────
 * Raymarine'in kendi sayfası: *"SeaTalk NG is Raymarine's cabling system used
 * to carry NMEA 2000 data… cables contain an extra communication wire for
 * SeaTalk 1"*; Actisense: *"On a data format / Protocol level, both of these
 * are identical… The only difference between the two is the physical layer."*
 * OpenSeaMap: *"SeaTalk-NG (Next Generation, former: SeaTalk²)"* — yani
 * **SeaTalk2 SeaTalkNG'nin ESKİ ADIDIR**, üçüncü bir protokol değil. Bu motor
 * NMEA 2000'e HİÇ dokunmaz; gateway korelasyonu ÇERÇEVELER ARASI bir iştir ve
 * parser'a girmez (`mavlink.ts`in SEQ-LOSS kararının aynısı). Sayfa metni tek
 * şeyi taşır: aynı komut baytları NMEA 2000 üzerinde **Raymarine proprietary
 * PGN 126720** içinde tünellenebilir (canboat
 * `126720-seatalk1Keystroke.yaml`: `seatalk1Command match: 134` = 0x86,
 * `126720-seatalk1PilotMode.yaml`: `match: 132` = 0x84).
 *
 * ── KAYNAĞIN KENDİ GÜVENİLİRLİK UYARISI ──────────────────────────────────
 * Knauf sayfasında birebir: *"the description is **incomplete inaccurate and
 * may even be wrong**."* Raymarine hiçbir resmî spec yayımlamadı; bazı
 * komutlar sayfada "unknown meaning" olarak duruyor (ör. Raystar 120'den gelen
 * `A7 09 86 …`). **Rozet `partial` bu yüzdendir** (kullanıcı kararı,
 * 2026-08-26) — ve `iec-61850` GOOSE-only sınıfından değil, `mil-std-1553`ün
 * "tip çerçevede yok" sınıfından.
 *
 * ── `build` SEKMESİ YOK → `encoder` YAZILMAZ ─────────────────────────────
 * Katalog `tabs`ında `'build'` yok; `definitions: ['vendor-map']` duruyor ama
 * PANEL YAZILMAZ (`snmp.ts:46` emsali) — tanım biçimi katalogda kalır.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import {
  SEATALK_TRANSLATION_KEY_PREFIX,
  byteAt,
  findSeatalkCommand,
  hexByte,
  hexString,
} from './seatalkCommands';
import type { SeatalkDecodedField } from './seatalkCommands';

const PROTOCOL_ID = 'seatalk';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md); katalog kaydıyla BİREBİR aynı. */
const PROTOCOL_DISPLAY_NAME = 'SeaTalk';

const TRANSLATION_KEY_PREFIX = SEATALK_TRANSLATION_KEY_PREFIX;

const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.error.tooShort`;
const ERROR_LENGTH_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.lengthMismatch`;
const ERROR_CHAIN_NOT_TILED = `${TRANSLATION_KEY_PREFIX}.error.chainNotTiled`;
const ERROR_COMPLEMENT_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.complementMismatch`;

const WARN_COMMAND_BIT_NOT_IN_BYTES = `${TRANSLATION_KEY_PREFIX}.warning.commandBitNotInBytes`;
const WARN_NO_INTEGRITY_CHECK = `${TRANSLATION_KEY_PREFIX}.warning.noIntegrityCheckOnWire`;
const WARN_COMMAND_PAYLOAD_NEEDS_VENDOR_MAP = `${TRANSLATION_KEY_PREFIX}.warning.commandPayloadNeedsVendorMap`;
const WARN_COMMAND_NOT_DOCUMENTED = `${TRANSLATION_KEY_PREFIX}.warning.commandNotDocumented`;
const WARN_LENGTH_MISMATCH = `${TRANSLATION_KEY_PREFIX}.warning.lengthMismatch`;
const WARN_DATAGRAM_BOUNDARY_UNVERIFIED = `${TRANSLATION_KEY_PREFIX}.warning.datagramBoundaryUnverified`;
const WARN_ADDITIONAL_DATAGRAMS_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.additionalDatagramsNotDecoded`;
const WARN_ENVELOPE_ONLY = `${TRANSLATION_KEY_PREFIX}.warning.envelopeOnly`;
const WARN_RAW_MODE_NO_NAMING = `${TRANSLATION_KEY_PREFIX}.warning.rawModeNoNaming`;

const FIELD_WARN_COMMAND_ASSUMED = `${TRANSLATION_KEY_PREFIX}.field.commandAssumed`;
const FIELD_WARN_PAYLOAD_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.field.payloadNotDecoded`;
const FIELD_WARN_COMPLEMENT_MISMATCH = `${TRANSLATION_KEY_PREFIX}.field.complementMismatch`;

/** Part 1 §Composition of Messages: *"Each datagram contains between 3 and 18 characters"*. */
export const SEATALK_MIN_DATAGRAM_LENGTH = 3;
export const SEATALK_MAX_DATAGRAM_LENGTH = 18;

/**
 * Uyarı KODU makine-okunur kısa addır, MESAJ çeviri anahtarıdır (`types.ts`in
 * kendi ayrımı: *"kod switch'lenir ve çevrilir, mesaj çevrilmiş metindir"*).
 * `adsb.ts`/`modeS.ts` emsali — `hdlcBasedMarine.ts` ikisini de anahtar yapıyor,
 * burada AYRIŞTIRILDI ki e2e ve testler kodla eşleşsin.
 */
function toProtocolWarning(
  code: string,
  message: string,
  offset?: number,
  length?: number,
): ProtocolWarning {
  return {
    code,
    message,
    ...(offset === undefined ? {} : { offset }),
    ...(length === undefined ? {} : { length }),
  };
}

/** `3 + (attribute & 0x0F)` — dosya başında üç bağımsız yerde doğrulanmış formül. */
export function seatalkDatagramLength(attribute: number): number {
  return SEATALK_MIN_DATAGRAM_LENGTH + (attribute & 0x0f);
}

// ── decodeOptions — DÖRT kanal ──────────────────────────────────────────────

const OPTION_COMMAND_BYTE_SOURCE = 'commandByteSource';
const OPTION_SEMANTIC_DEPTH = 'semanticDepth';
const OPTION_STRICT_LENGTH = 'strictLength';
const OPTION_COMPLEMENT_CHECK = 'complementCheck';

const COMMAND_SOURCE_ASSUME_FIRST_BYTE = 'assumeFirstByte';
const COMMAND_SOURCE_LENGTH_CHAINED = 'lengthChained';
const COMMAND_SOURCE_VALUES = [COMMAND_SOURCE_ASSUME_FIRST_BYTE, COMMAND_SOURCE_LENGTH_CHAINED] as const;

const SEMANTIC_DEPTH_ENVELOPE = 'envelope';
const SEMANTIC_DEPTH_KNOWN_COMMANDS = 'knownCommands';
const SEMANTIC_DEPTH_RAW = 'raw';
const SEMANTIC_DEPTH_VALUES = [
  SEMANTIC_DEPTH_ENVELOPE,
  SEMANTIC_DEPTH_KNOWN_COMMANDS,
  SEMANTIC_DEPTH_RAW,
] as const;
type SemanticDepth = (typeof SEMANTIC_DEPTH_VALUES)[number];

const BOOLEAN_TRUE = 'true';
const BOOLEAN_FALSE = 'false';
const BOOLEAN_VALUES = [BOOLEAN_TRUE, BOOLEAN_FALSE] as const;

const BOOLEAN_CHOICES = [
  { value: BOOLEAN_TRUE, label: `${TRANSLATION_KEY_PREFIX}.option.boolean.on` },
  { value: BOOLEAN_FALSE, label: `${TRANSLATION_KEY_PREFIX}.option.boolean.off` },
] as const;

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_COMMAND_BYTE_SOURCE,
    label: `${TRANSLATION_KEY_PREFIX}.option.commandByteSource`,
    kind: 'select',
    defaultValue: COMMAND_SOURCE_ASSUME_FIRST_BYTE,
    description: `${TRANSLATION_KEY_PREFIX}.option.commandByteSource.description`,
    choices: [
      {
        value: COMMAND_SOURCE_ASSUME_FIRST_BYTE,
        label: `${TRANSLATION_KEY_PREFIX}.option.commandByteSource.assumeFirstByte`,
      },
      {
        value: COMMAND_SOURCE_LENGTH_CHAINED,
        label: `${TRANSLATION_KEY_PREFIX}.option.commandByteSource.lengthChained`,
      },
    ],
  },
  {
    id: OPTION_SEMANTIC_DEPTH,
    label: `${TRANSLATION_KEY_PREFIX}.option.semanticDepth`,
    kind: 'select',
    defaultValue: SEMANTIC_DEPTH_KNOWN_COMMANDS,
    description: `${TRANSLATION_KEY_PREFIX}.option.semanticDepth.description`,
    choices: [
      { value: SEMANTIC_DEPTH_ENVELOPE, label: `${TRANSLATION_KEY_PREFIX}.option.semanticDepth.envelope` },
      {
        value: SEMANTIC_DEPTH_KNOWN_COMMANDS,
        label: `${TRANSLATION_KEY_PREFIX}.option.semanticDepth.knownCommands`,
      },
      { value: SEMANTIC_DEPTH_RAW, label: `${TRANSLATION_KEY_PREFIX}.option.semanticDepth.raw` },
    ],
  },
  {
    id: OPTION_STRICT_LENGTH,
    label: `${TRANSLATION_KEY_PREFIX}.option.strictLength`,
    kind: 'select',
    defaultValue: BOOLEAN_TRUE,
    description: `${TRANSLATION_KEY_PREFIX}.option.strictLength.description`,
    choices: BOOLEAN_CHOICES,
  },
  {
    id: OPTION_COMPLEMENT_CHECK,
    label: `${TRANSLATION_KEY_PREFIX}.option.complementCheck`,
    kind: 'select',
    defaultValue: BOOLEAN_TRUE,
    description: `${TRANSLATION_KEY_PREFIX}.option.complementCheck.description`,
    choices: BOOLEAN_CHOICES,
  },
];

function readSelectOption<T extends string>(
  options: Record<string, unknown> | undefined,
  id: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = options?.[id];
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function readBooleanOption(
  options: Record<string, unknown> | undefined,
  id: string,
  fallback: boolean,
): boolean {
  const raw = readSelectOption(options, id, BOOLEAN_VALUES, fallback ? BOOLEAN_TRUE : BOOLEAN_FALSE);
  return raw === BOOLEAN_TRUE;
}

// ── Datagram zinciri — `lengthChained` modunun tek işi ──────────────────────

interface ChainAnalysis {
  /** Zincir girdiyi TAM olarak döşüyor mu. */
  readonly tiled: boolean;
  /** Döşenen datagram sayısı (döşenmiyorsa: sınırdan önce sayılabilenler). */
  readonly datagramCount: number;
}

/**
 * `3 + (attr & 0x0F)` zincirini girdi boyunca yürütür. Zincir TAM döşerse
 * datagram sınırları YAPISAL olarak doğrulanmış olur; döşemezse girdi ya
 * yanlış hizalanmıştır ya SeaTalk değildir — ikisi de baytlardan AYIRT
 * EDİLEMEZ (dosya başı), o yüzden karar "doğrulanamadı"dır, "hatalı" değil.
 */
export function analyzeSeatalkChain(data: Uint8Array): ChainAnalysis {
  let offset = 0;
  let datagramCount = 0;
  while (offset + SEATALK_MIN_DATAGRAM_LENGTH <= data.length) {
    const length = seatalkDatagramLength(byteAt(data, offset + 1));
    if (offset + length > data.length) {
      return { tiled: false, datagramCount };
    }
    offset += length;
    datagramCount += 1;
  }
  return { tiled: offset === data.length && datagramCount > 0, datagramCount };
}

function toParsedField(
  data: Uint8Array,
  decoded: SeatalkDecodedField,
  idPrefix: string,
): ParsedField {
  return {
    id: `${idPrefix}${decoded.id}`,
    name: decoded.name,
    offset: decoded.offset,
    length: decoded.length,
    rawBytes: data.slice(decoded.offset, decoded.offset + decoded.length),
    ...(decoded.rawValue === undefined ? {} : { rawValue: decoded.rawValue }),
    ...(decoded.physicalValue === undefined ? {} : { physicalValue: decoded.physicalValue }),
    ...(decoded.unit === undefined ? {} : { unit: decoded.unit }),
    valid: true,
    warnings: [...(decoded.warnings ?? [])],
  };
}

function parseSeatalkDatagram(data: Uint8Array, context?: ParseContext): ParseResult {
  if (context?.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
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
  if (data.length < SEATALK_MIN_DATAGRAM_LENGTH) {
    // Part 1 §Collision Management: kısa mesaj GEÇERSİZDİR, tamamen atılır.
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_TOO_SHORT, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const options = context?.options;
  const commandByteSource = readSelectOption(
    options,
    OPTION_COMMAND_BYTE_SOURCE,
    COMMAND_SOURCE_VALUES,
    COMMAND_SOURCE_ASSUME_FIRST_BYTE,
  );
  const semanticDepth: SemanticDepth = readSelectOption(
    options,
    OPTION_SEMANTIC_DEPTH,
    SEMANTIC_DEPTH_VALUES,
    SEMANTIC_DEPTH_KNOWN_COMMANDS,
  );
  const strictLength = readBooleanOption(options, OPTION_STRICT_LENGTH, true);
  const complementCheck = readBooleanOption(options, OPTION_COMPLEMENT_CHECK, true);

  const commandByte = byteAt(data, 0);
  const attribute = byteAt(data, 1);
  const additionalByteCount = attribute & 0x0f;
  const expectedLength = seatalkDatagramLength(attribute);

  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  const chain = commandByteSource === COMMAND_SOURCE_LENGTH_CHAINED ? analyzeSeatalkChain(data) : undefined;

  // ── Uzunluk kararı ───────────────────────────────────────────────────────
  if (data.length < expectedLength) {
    // Eksik bayt her modda ölümcüldür: Knauf'un "cancel totally" kuralı.
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_TOO_SHORT,
        offset: 0,
        length: data.length,
        details: { expectedLength, actualLength: data.length },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }
  if (chain === undefined) {
    if (data.length !== expectedLength) {
      if (strictLength) {
        return {
          success: false,
          error: {
            code: 'length-mismatch',
            message: ERROR_LENGTH_MISMATCH,
            offset: 1,
            length: 1,
            details: { expectedLength, actualLength: data.length },
          },
          consumedBytes: 0,
          recoverable: true,
        };
      }
      warnings.push(toProtocolWarning('lengthMismatch', WARN_LENGTH_MISMATCH, 1, 1));
    }
  } else if (!chain.tiled) {
    if (strictLength) {
      return {
        success: false,
        error: {
          code: 'length-mismatch',
          message: ERROR_CHAIN_NOT_TILED,
          offset: 0,
          length: data.length,
          details: { datagramCount: chain.datagramCount },
        },
        consumedBytes: 0,
        recoverable: true,
      };
    }
    warnings.push(toProtocolWarning('datagramBoundaryUnverified', WARN_DATAGRAM_BOUNDARY_UNVERIFIED, 0, data.length));
  } else if (chain.datagramCount > 1) {
    warnings.push(toProtocolWarning('additionalDatagramsNotDecoded', WARN_ADDITIONAL_DATAGRAMS_NOT_DECODED, expectedLength, data.length - expectedLength));
  }

  // Bundan sonrası YALNIZ İLK datagram üzerinde çalışır.
  const datagram = data.slice(0, expectedLength);
  const definition = findSeatalkCommand(commandByte);

  const fields: ParsedField[] = [];

  // ── Zarf ─────────────────────────────────────────────────────────────────
  const namingEnabled = semanticDepth !== SEMANTIC_DEPTH_RAW;
  const commandName = namingEnabled ? definition?.name : undefined;
  fields.push({
    id: 'command',
    // "(assumed)": komut biti çerçevede YOK, ilk bayt olduğu VARSAYILIYOR.
    name: 'Command (assumed)',
    offset: 0,
    length: 1,
    rawBytes: datagram.slice(0, 1),
    rawValue: hexByte(commandByte),
    ...(commandName === undefined ? {} : { physicalValue: commandName }),
    valid: true,
    warnings: [FIELD_WARN_COMMAND_ASSUMED],
  });

  fields.push({
    id: 'attribute',
    name: 'Attribute',
    offset: 1,
    length: 1,
    rawBytes: datagram.slice(1, 2),
    rawValue: hexByte(attribute),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'attribute-additional-byte-count',
    name: 'Attribute · Additional Byte Count (bit 0:3)',
    offset: 1,
    length: 1,
    rawBytes: datagram.slice(1, 2),
    rawValue: additionalByteCount,
    physicalValue: `total ${expectedLength} bytes`,
    valid: true,
    warnings: [],
  });
  fields.push({
    id: 'attribute-data-nibble',
    // TUZAK (dosya başı): yüksek nibble DOLGU DEĞİL, komuta göre VERİDİR.
    name: 'Attribute · Data Nibble (bit 4:7)',
    offset: 1,
    length: 1,
    rawBytes: datagram.slice(1, 2),
    rawValue: (attribute & 0xf0) >> 4,
    valid: true,
    warnings: [],
  });

  if (chain !== undefined && chain.tiled) {
    fields.push({
      id: 'datagram-chain',
      name: 'Datagram Chain · Tiled Datagram Count',
      offset: 0,
      length: data.length,
      rawBytes: data,
      rawValue: chain.datagramCount,
      valid: true,
      warnings: [],
    });
  }

  // ── Yük ──────────────────────────────────────────────────────────────────
  const payloadOffset = 2;
  const payloadLength = expectedLength - payloadOffset;
  const decoder = semanticDepth === SEMANTIC_DEPTH_KNOWN_COMMANDS ? definition?.decodePayload : undefined;

  if (semanticDepth === SEMANTIC_DEPTH_RAW) {
    warnings.push(toProtocolWarning('rawModeNoNaming', WARN_RAW_MODE_NO_NAMING));
    for (let index = payloadOffset; index < expectedLength; index += 1) {
      fields.push({
        id: `data-byte-${index}`,
        name: `Data Byte ${index}`,
        offset: index,
        length: 1,
        rawBytes: datagram.slice(index, index + 1),
        rawValue: hexByte(byteAt(datagram, index)),
        valid: true,
        warnings: [],
      });
    }
  } else if (decoder !== undefined) {
    for (const decoded of decoder(datagram)) {
      fields.push(toParsedField(datagram, decoded, ''));
    }
  } else {
    if (semanticDepth === SEMANTIC_DEPTH_ENVELOPE) {
      warnings.push(toProtocolWarning('envelopeOnly', WARN_ENVELOPE_ONLY));
    } else {
      // `ads-b`nin TC 5-8/28/29/31 kararının biçimi: TANINIR, ÇÖZÜLMEZ.
      warnings.push(toProtocolWarning('commandPayloadNeedsVendorMap', WARN_COMMAND_PAYLOAD_NEEDS_VENDOR_MAP, payloadOffset, payloadLength));
    }
    if (payloadLength > 0) {
      fields.push({
        id: 'data',
        name: 'Data (raw)',
        offset: payloadOffset,
        length: payloadLength,
        rawBytes: datagram.slice(payloadOffset),
        rawValue: hexString(datagram.slice(payloadOffset)),
        valid: true,
        warnings: semanticDepth === SEMANTIC_DEPTH_ENVELOPE ? [] : [FIELD_WARN_PAYLOAD_NOT_DECODED],
      });
    }
  }

  if (definition === undefined) {
    warnings.push(toProtocolWarning('commandNotDocumented', WARN_COMMAND_NOT_DOCUMENTED, 0, 1));
  }

  // ── Tümleyen çifti — YALNIZ tanımlı olduğu komutlarda ────────────────────
  let frameValid = true;
  if (complementCheck && definition?.complementPairs !== undefined) {
    for (const [valueIndex, complementIndex] of definition.complementPairs) {
      if (complementIndex >= expectedLength) continue;
      const value = byteAt(datagram, valueIndex);
      const complement = byteAt(datagram, complementIndex);
      // Part 1 §Data Coding: *"The sum of both bytes must always be 0xFF."*
      const pairValid = value + complement === 0xff;
      fields.push({
        id: `complement-${complementIndex}`,
        name: `Complement of byte ${valueIndex} (sum must be 0xFF)`,
        offset: complementIndex,
        length: 1,
        rawBytes: datagram.slice(complementIndex, complementIndex + 1),
        rawValue: hexByte(complement),
        physicalValue: pairValid ? 'PASS' : `FAIL (expected ${hexByte(value ^ 0xff)})`,
        valid: pairValid,
        warnings: pairValid ? [] : [FIELD_WARN_COMPLEMENT_MISMATCH],
      });
      if (!pairValid) {
        frameValid = false;
        errors.push({
          // `xmodem.ts` emsali: tümleyen artıklığı bir CHECKSUM DEĞİLDİR,
          // o yüzden `checksum-mismatch` kodu KULLANILMAZ.
          code: 'value-out-of-range',
          message: ERROR_COMPLEMENT_MISMATCH,
          offset: complementIndex,
          length: 1,
          details: { value, complement, expected: value ^ 0xff },
        });
      }
    }
  }

  // ── KOŞULSUZ uyarılar ────────────────────────────────────────────────────
  warnings.push(toProtocolWarning('commandBitNotInBytes', WARN_COMMAND_BIT_NOT_IN_BYTES, 0, 1));
  warnings.push(toProtocolWarning('noIntegrityCheckOnWire', WARN_NO_INTEGRITY_CHECK));

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
    valid: frameValid,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: expectedLength };
}

export const seatalkParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * DAİMA `false` — dosya başındaki "`canParse` DAİMA `false`" bölümü. Girdi
   * HİÇ okunmaz: baytlarda ayırt edici sinyal yok (sihirli sayı/checksum/
   * sınırlayıcı/adres yok) ve tek imza olan uzunluk formülü ÖLÇÜLDÜ —
   * naif hâlinde 27/870, en dar hâlinde bile 7/870 yanlış pozitif.
   * Bekçi: `seatalkCanParseRegistry.test.ts`.
   */
  canParse(): boolean {
    return false;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseSeatalkDatagram(data, context);
  },
};

// ── Örnekler ───────────────────────────────────────────────────────────────
// Dördü Knauf Part 2'nin GERÇEK yakalamalarıdır; ikisi (heading ve bozuk
// tümleyen) Knauf'un formülünden/örneğinden TÜRETİLMİŞTİR ve açıklamasında
// böyle yazar. Üretilmiş "gerçek gibi" veri YOK.

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'keystroke-minus-one',
    // Part 2, komut 86: "11 05 FA → -1", Z101 uzaktan kumanda. 0x05+0xFA=0xFF.
    name: `${TRANSLATION_KEY_PREFIX}.example.keystrokeMinusOne.name`,
    bytes: Uint8Array.from([0x86, 0x11, 0x05, 0xfa]),
    description: `${TRANSLATION_KEY_PREFIX}.example.keystrokeMinusOne.description`,
    expectedValid: true,
  },
  {
    id: 'keystroke-complement-mismatch',
    // Aynı çerçeve, tümleyen baytı bir bit bozulmuş — artıklığın GERÇEKTEN
    // sınandığını (yalnız gösterilmediğini) kanıtlar.
    name: `${TRANSLATION_KEY_PREFIX}.example.keystrokeComplementMismatch.name`,
    bytes: Uint8Array.from([0x86, 0x11, 0x05, 0xfb]),
    description: `${TRANSLATION_KEY_PREFIX}.example.keystrokeComplementMismatch.description`,
    expectedValid: false,
  },
  {
    id: 'equipment-id-400g',
    // Part 2, komut 01: "01 05 00 00 00 60 01 00 → Course Computer 400G".
    // TANINIR (ad basılır) ama payload ÇÖZÜLMEZ — tek kaynak.
    name: `${TRANSLATION_KEY_PREFIX}.example.equipmentId400g.name`,
    bytes: Uint8Array.from([0x01, 0x05, 0x00, 0x00, 0x00, 0x60, 0x01, 0x00]),
    description: `${TRANSLATION_KEY_PREFIX}.example.equipmentId400g.description`,
    expectedValid: true,
  },
  {
    id: 'compass-heading-rudder',
    // Knauf'un 9C formülünden TÜRETİLDİ: U=1, VW=0x2D, RR=0xFE.
    // heading = (1&3)*90 + (0x2D&0x3F)*2 + popcount(U&0xC)=0 → 90+90 = 180°.
    // RR=0xFE → -2° (Part 2'nin kendi örneği: "0xFE = 2° left").
    name: `${TRANSLATION_KEY_PREFIX}.example.compassHeadingRudder.name`,
    bytes: Uint8Array.from([0x9c, 0x11, 0x2d, 0xfe]),
    description: `${TRANSLATION_KEY_PREFIX}.example.compassHeadingRudder.description`,
    expectedValid: true,
  },
  {
    id: 'unknown-meaning-a7',
    // Part 2, komut A7: "A7 09 86 000000000000000079 Unknown meaning, sent by
    // Raystar 120 GPS" — kaynağın KENDİSİ anlamını bilmiyor.
    name: `${TRANSLATION_KEY_PREFIX}.example.unknownMeaningA7.name`,
    bytes: Uint8Array.from([0xa7, 0x09, 0x86, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x79]),
    description: `${TRANSLATION_KEY_PREFIX}.example.unknownMeaningA7.description`,
    expectedValid: true,
  },
  {
    id: 'target-waypoint-name',
    // Part 2, komut 82: karakter formülü + ÜÇ tümleyen çifti. Baytlar
    // Knauf'un dört karakterlik formülü TERSİNE çevrilerek "WPT1" adı için
    // kuruldu; tümleyenler 0xFF tamamlayıcısıdır.
    name: `${TRANSLATION_KEY_PREFIX}.example.targetWaypointName.name`,
    bytes: Uint8Array.from([0x82, 0x05, 0x27, 0xd8, 0x48, 0xb7, 0x06, 0xf9]),
    description: `${TRANSLATION_KEY_PREFIX}.example.targetWaypointName.description`,
    expectedValid: true,
  },
];

export const seatalkPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'marine-navigation',
  parser: seatalkParser,
  // 'build' sekmesi YOK (katalog) → `encoder` YAZILMAZ.
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'multi-layer',
    references: [
      {
        title: 'Thomas Knauf — SeaTalk Technical Reference Part 1: How SeaTalk works (Rev. 3.23)',
        url: 'http://www.thomasknauf.de/rap/seatalk1.htm',
      },
      {
        title: 'Thomas Knauf — SeaTalk Technical Reference Part 2: Recognized Datagrams',
        url: 'http://www.thomasknauf.de/rap/seatalk2.htm',
      },
      {
        title: 'SignalK nmea0183-signalk — SeaTalk1 datagram hooks (21 datagrams)',
        url: 'https://github.com/SignalK/nmea0183-signalk/tree/master/src/hooks/seatalk',
      },
      {
        title: 'canboat — PGN 126720 Seatalk1 Keystroke / Pilot Mode tunnel (Raymarine proprietary)',
        url: 'https://github.com/canboat/canboat/blob/master/database/pgns/126720-seatalk1Keystroke.yaml',
      },
      {
        title: 'Raymarine — SeaTalk NG carries NMEA 2000 data (SeaTalk 1 is a separate wire)',
        url: 'https://www.raymarine.com/en-us/our-products/networking-and-accessories/seatalk-ng-and-nmea-2000',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
