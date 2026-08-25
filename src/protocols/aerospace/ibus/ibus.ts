/**
 * IBUS — FlySky'ın 115200 baud seri RC ve telemetri veri yolu. İKİ AYRI
 * çerçeve modeli TEK kayıtta: iA6 (31 bayt, sync 0x55) ve iA6B (32 bayt,
 * uzunluk+komut header'ı), `decodeOptions`teki `profile` şıkkıyla seçilir.
 * Faz 10, dalga 15c (`brief-faz10-dalga15c.md`).
 *
 * ── KAYNAK (ana thread'in 2026-08-25 kaynak turu — DOĞRULANMIŞ) ────────────
 * Betaflight `rx/ibus.c` (senkron/uzunluk ayrımı `:80-83`, kanal maskesi
 * `updateChannelData`, üst nibble türetimi `:163-164`, iA6 checksum
 * `isChecksumOkIa6` `:133-144`) + `telemetry/ibus_shared.c:493-511` (iA6B
 * checksum) + ArduPilot `AP_RCProtocol_IBUS.cpp` (bağımsız ikinci kaynak —
 * senkron/komut zorunluluğu `:29`, üst nibble'ı failsafe sayan yorum `:45-49`)
 * + spec özeti `06-havacilik-uav.md:207-218`.
 *
 * ── İKİ MODEL, TEK kayıt — `decodeOptions` ZORUNLU ─────────────────────────
 * | Model | Senkron | Çerçeve | Checksum tohumu | Kanal offset |
 * |---|---|---|---|---|
 * | iA6  | ilk bayt 0x55 | 31 bayt | 0x0000 (TOPLAMA) | 1 |
 * | iA6B | ilk bayt = UZUNLUK (0x20) | 32 bayt | 0xFFFF (ÇIKARMA) | 2 |
 * Otomatik profil TAHMİNİ yapılmaz — ilk baytın 0x55 olması iA6 KANITI
 * DEĞİLDİR (iA6B'de ilk bayt uzunluktur, 0x55=85 de "geçerli görünen" bir
 * uzunluk olabilirdi, gerçi 32'den büyük olduğu için bu spesifik değer
 * `canParse`te zaten elenir). `parse()` KULLANICININ seçtiği profili
 * uygular, `microwire.ts`in profil kararının aynısı ("aynı dört bayt, x8
 * profiliyle READ 0x2A, x16 profiliyle bambaşka bir şey; tahmin etmek
 * uydurmaktır").
 *
 * ── ÇERÇEVE ──────────────────────────────────────────────────────────────
 * iA6B (32 bayt): [0] Length=0x20 · [1] Command=0x40 (RC channel command) ·
 *   [2..29] 14×2 bayt LE kanal yuvası · [30..31] Checksum (LE).
 * iA6  (31 bayt): [0] Sync=0x55 · [1..28] 14×2 bayt LE kanal yuvası ·
 *   [29..30] Checksum (LE).
 * Komut baytı (iA6B `[1]`): ArduPilot `AP_RCProtocol_IBUS.cpp:29` bunu
 * ZORUNLU kılıyor (`frame[1] != 0x40` → reddet); Betaflight'ın RX yolu
 * `[1]`i HİÇ denetlemiyor. Bu motor Betaflight'ın yolunu izler: `[1]` KOMUT
 * adıyla basılır, 0x40 dışında bir değerde UYARI verir ama çözmeyi
 * REDDETMEZ — iki referans uygulama ayrıştığında daha SIKI olanı çökme
 * nedeni yapmak yerine bilgilendirici tutmak tercih edildi.
 *
 * ── ÇEKSUM: İKİ AYRI FONKSİYON, TEK PARAMETRELİ FONKSİYON DEĞİL ────────────
 * İki model AYNI algoritmanın parametrelenmiş hâli DEĞİLDİR:
 *  • iA6  → `computeIa6Checksum`: senkron baytı (byte0) KAPSAM DIŞI, 14 kanal
 *    yuvasının 16-bit LE SÖZCÜKLERİ toplanır (`rx/ibus.c:133-144`
 *    `isChecksumOkIa6`: `chksum=0`; `o=1..27` adım 2, `chksum += ibus[o] +
 *    (ibus[o+1]<<8)`; `rxsum = ibus[29] + (ibus[30]<<8)`).
 *  • iA6B → `computeIa6bChecksum`: tohum 0xFFFF, checksum'dan ÖNCEKİ BÜTÜN
 *    30 bayt (UZUNLUK VE KOMUT BAYTLARI DAHİL) tek tek ÇIKARILIR
 *    (`telemetry/ibus_shared.c:493-511`: `checksum=0xFFFF; dataSize=
 *    ibusPacket[0]-2; for(i<dataSize) checksum -= ibusPacket[i];` — karşılaştırma
 *    düşük bayt `packet[30]`, yüksek bayt `packet[31]`). ArduPilot'ın
 *    biçimi (`chksum=96; …; ==0xFFFF`, 96=0x20+0x40) CEBİRSEL olarak AYNI —
 *    ikinci bağımsız kaynak bunu TEYİT ediyor.
 * Bu ayrım BİLEREK tek bir `seed`/`sign` parametreli ortak fonksiyona
 * SIKIŞTIRILMADI (brief-faz10-dalga15c.md, ana thread kararı) — kapsam
 * (senkron bayt dahil mi/değil mi) ve birim (bayt mı, 16-bit sözcük mü) de
 * farklı, yalnız işaret (+/-) farklı değil.
 *
 * ── ⚠ ÜST NİBBLE: İKİ KAYNAK ÇELİŞİYOR, HAM BASILIR ────────────────────────
 * Her kanal yuvasının üst baytının üst nibble'ı (`(word >> 12) & 0xF`) İKİ
 * FARKLI biçimde yorumlanıyor ve bu iki yorum BİRBİRİYLE ÇELİŞİYOR:
 *  • Betaflight `rx/ibus.c:163-164`: dört ek 12-bit "ek kanal" (indeks 14-17)
 *    üç FARKLI kanalın üst nibble'ını BİRLEŞTİREREK türetiyor:
 *    `ibusChannelData[i] = ((ibus[o]&0xF0)>>4) | (ibus[o+2]&0xF0) |
 *    ((ibus[o+4]&0xF0)<<4)` (iA6B'de o=3,9,15,21). Bu, TEK bir kanalın kendi
 *    üst nibble'ı DEĞİL, üç ayrı kanalın üst nibble'ının BİRLEŞİMİDİR.
 *  • ArduPilot `AP_RCProtocol_IBUS.cpp:45-49`: AYNI baytların (frame[3],
 *    frame[9]) üst nibble'ını FAILSAFE göstergesi sayıyor:
 *    `if ((frame[3]&0xF0) || (frame[9]&0xF0)) failsafe=true;`.
 * **Karar (ana thread, uygulanır — sorulmaz):** üst nibble'lar HAM alan
 * olarak, HER KANAL YUVASI İÇİN AYRI AYRI basılır — ne Betaflight'ın üç-baytı-
 * birleştiren "ek kanal" grubu, ne ArduPilot'ın "failsafe" yorumu KURULMAZ.
 * İkisini birleştirmek ya da birini seçmek KAYNAKLARDAN BİRİNİ UYDURMAK
 * olurdu. Her üst nibble alanı, iki yorumu da kaynağıyla adlandıran bir
 * uyarı taşır (`WARN_UPPER_NIBBLE_AMBIGUOUS`). Brif bunu "doğrulanmış kaynak
 * yok" diye yazmıştı — YANLIŞ: kaynaklar VAR ve ÇELİŞİYORLAR, bu yüzden ham
 * kalma kararı AYNI ama gerekçe farklı (bkz. `docs/brief-faz10-dalga15c.md`
 * "Çürüyen tahminler").
 * Kanal DEĞERİNİN KENDİSİ (12 bit, alt bayt + üst baytın ALT nibble'ı) iki
 * kaynakta da BİREBİR aynı — `rx/ibus.c:160`: `ibus[o] | ((ibus[o+1]&0x0F)
 * <<8)`; `AP_RCProtocol_IBUS.cpp:35` aynı maske. Orada çelişki YOK.
 *
 * ── i-BUS2: KAPSAM DIŞI, rozet `partial` ─────────────────────────────────
 * i-BUS2 ağaç topolojisi için halka açık tel biçimi kaynağı BULUNAMADI
 * (FlySky yayınlamamış, Betaflight uygulamamış). `profile` seçeneği yalnız
 * `ia6`/`ia6b` şıklarıyla açılır; i-BUS2 seçenek listesinde YOKTUR ve bu
 * bilinçli sınır seçeneğin açıklamasında AÇIKÇA yazılıdır. Ayrıca HER başarılı
 * çözümde bir kapsam-dışı uyarısı basılır (`WARN_IBUS2_OUT_OF_SCOPE`) — bu
 * sınırlama çerçeve içeriğine bağlı DEĞİL, HER ZAMAN doğru, bu yüzden HER
 * ZAMAN bildirilir (dronecan.ts'in DSDL uyarısının "içerik varsa bildir"
 * modelinden farklı: burada koşul yok, sabit bir kapsam kararı var).
 *
 * ── Rozet: `partial` ────────────────────────────────────────────────────
 * Klasik i-BUS (iA6/iA6B) TAM çözülür ve checksum DOĞRULANIR — eksik olan
 * yalnız i-BUS2, kaynaksızlık yüzünden (eksik uygulama değil, kaynak yok).
 *
 * ── ALAN ADLANDIRMA / UZUNLUK TOLERANSI ─────────────────────────────────
 * `ParsedField.id` kanal İNDEKSİNİ taşır (`ibus-channel-0`…`-13`), offset'i
 * DEĞİL (sbus.ts'in aynı kararı). Checksum konumu HER ZAMAN `channelOffset +
 * 14×2`dir (data.length'e göre DEĞİL) — bu, aynı bayt dizisinin farklı
 * profille yeniden yorumlanabilmesini sağlar (bkz. `ibus.test.ts`/
 * `e2e/ibus-decode.spec.ts`: profil değişince checksum sonucu GERÇEKTEN
 * değişir, seçeneğin bağlı olduğunun kanıtı). Gerekli uzunluktan UZUN
 * girdi reddedilmez (fazla bayt bir uyarıyla bildirilir), KISA girdi
 * `truncated-frame`dir.
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
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

const PROTOCOL_ID = 'ibus';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'IBUS';

const IBUS_CHANNEL_SLOTS = 14;
const CHANNEL_VALUE_MASK = 0x0fff; // 12 bit — rx/ibus.c:160

const IA6_ID = 'ia6';
const IA6B_ID = 'ia6b';
const OPTION_PROFILE = 'profile';
const DEFAULT_PROFILE_ID = IA6B_ID;

const IA6_SYNC_BYTE = 0x55;
const IA6_CHANNEL_OFFSET = 1;

const IA6B_LENGTH_BYTE = 0x20; // 32 — çerçevenin kendi uzunluğunu bildirir
const IA6B_COMMAND_BYTE = 0x40;
const IA6B_CHANNEL_OFFSET = 2;

interface IbusProfile {
  readonly id: 'ia6' | 'ia6b';
  readonly channelOffset: number;
  /** Alan tablosunun ilk satırında/seçenek açıklamasında görünen ad. */
  readonly label: string;
}

const IA6_PROFILE: IbusProfile = {
  id: 'ia6',
  channelOffset: IA6_CHANNEL_OFFSET,
  label: 'iA6 (31 bayt, sync 0x55, toplama checksum)',
};
const IA6B_PROFILE: IbusProfile = {
  id: 'ia6b',
  channelOffset: IA6B_CHANNEL_OFFSET,
  label: 'iA6B (32 bayt, uzunluk+komut header, çıkarma checksum)',
};

/** Kanal verisinin bittiği, checksum'ın başladığı offset (dosya başı "Alan adlandırma"). */
function channelsEndOffset(profile: IbusProfile): number {
  return profile.channelOffset + IBUS_CHANNEL_SLOTS * 2;
}

const IA6_FRAME_LENGTH = channelsEndOffset(IA6_PROFILE) + 2; // 31
const IA6B_FRAME_LENGTH = channelsEndOffset(IA6B_PROFILE) + 2; // 32

const ERROR_FRAME_TOO_SHORT = 'protocol.ibus.error.frameTooShort';
const ERROR_INVALID_LENGTH_BYTE = 'protocol.ibus.error.invalidLengthByte';
const ERROR_INVALID_SYNC_BYTE = 'protocol.ibus.error.invalidSyncByte';
const ERROR_CHECKSUM_MISMATCH = 'protocol.ibus.error.checksumMismatch';
const ERROR_ABORTED = 'protocol.ibus.error.aborted';

const WARN_UNEXPECTED_COMMAND_BYTE = 'protocol.ibus.warning.unexpectedCommandByte';
const WARN_UPPER_NIBBLE_AMBIGUOUS = 'protocol.ibus.warning.upperNibbleAmbiguous';
const WARN_IBUS2_OUT_OF_SCOPE = 'protocol.ibus.warning.ibus2OutOfScope';
const WARN_TRAILING_BYTES = 'protocol.ibus.warning.trailingBytes';

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_PROFILE,
    label: 'protocol.ibus.option.profile',
    kind: 'select',
    defaultValue: DEFAULT_PROFILE_ID,
    description: 'protocol.ibus.option.profile.description',
    choices: [
      { value: IA6B_ID, label: 'protocol.ibus.option.profile.ia6b' },
      { value: IA6_ID, label: 'protocol.ibus.option.profile.ia6' },
    ],
  },
];

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** `options?.profile` tanınmıyor/eksikse varsayılan iA6B'ye düşer (`microwire.ts`in aynı toleransı). */
function resolveProfile(options: Record<string, unknown> | undefined): IbusProfile {
  const requested = typeof options?.[OPTION_PROFILE] === 'string' ? options[OPTION_PROFILE] : DEFAULT_PROFILE_ID;
  return requested === IA6_ID ? IA6_PROFILE : IA6B_PROFILE;
}

/** iA6 — senkron baytı KAPSAM DIŞI, 14 kanal yuvasının 16-bit LE sözcükleri toplanır (dosya başı). */
function computeIa6Checksum(data: Uint8Array): number {
  let sum = 0;
  for (let slot = 0; slot < IBUS_CHANNEL_SLOTS; slot += 1) {
    const offset = IA6_CHANNEL_OFFSET + slot * 2;
    const word = byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
    sum = (sum + word) & 0xffff;
  }
  return sum;
}

/** iA6B — tohum 0xFFFF, checksum'dan önceki BÜTÜN baytlar tek tek çıkarılır (dosya başı). */
function computeIa6bChecksum(data: Uint8Array): number {
  let checksum = 0xffff;
  const dataSize = channelsEndOffset(IA6B_PROFILE); // 30 — uzunluk+komut DAHİL
  for (let index = 0; index < dataSize; index += 1) {
    checksum = (checksum - byteAt(data, index)) & 0xffff;
  }
  return checksum;
}

function computeChecksum(data: Uint8Array, profile: IbusProfile): number {
  return profile.id === 'ia6' ? computeIa6Checksum(data) : computeIa6bChecksum(data);
}

function readTransmittedChecksum(data: Uint8Array, checksumOffset: number): number {
  return byteAt(data, checksumOffset) | (byteAt(data, checksumOffset + 1) << 8);
}

interface ChannelSlotFields {
  readonly value: ParsedField;
  readonly upperNibble: ParsedField;
}

/**
 * Bir kanal yuvasını (12-bit değer + ham üst nibble) `ParsedField` çiftine
 * çevirir. `id` kanal İNDEKSİNİ taşır, offset'i DEĞİL (dosya başı).
 */
function channelSlotFields(data: Uint8Array, profile: IbusProfile, index: number): ChannelSlotFields {
  const lowByteOffset = profile.channelOffset + index * 2;
  const highByteOffset = lowByteOffset + 1;
  const low = byteAt(data, lowByteOffset);
  const high = byteAt(data, highByteOffset);
  const word = low | (high << 8);
  const value = word & CHANNEL_VALUE_MASK;
  const upperNibble = (word >>> 12) & 0x0f;

  return {
    value: {
      id: `ibus-channel-${String(index)}`,
      name: `CH${String(index + 1)} (bit 0:11)`,
      offset: lowByteOffset,
      length: 2,
      rawBytes: data.slice(lowByteOffset, lowByteOffset + 2),
      // Ham 12-bit değer — `unit` YOK (paketlenmiş sayı, fiziksel büyüklük değil).
      rawValue: value,
      valid: true,
      warnings: [],
    },
    upperNibble: {
      id: `ibus-channel-${String(index)}-upper-nibble`,
      name: `CH${String(index + 1)} Upper Nibble (bit 12:15)`,
      offset: highByteOffset,
      length: 1,
      rawBytes: data.slice(highByteOffset, highByteOffset + 1),
      rawValue: upperNibble,
      valid: true,
      // Dosya başı "Üst nibble" — iki kaynak çelişiyor, ham + uyarı.
      warnings: [WARN_UPPER_NIBBLE_AMBIGUOUS],
    },
  };
}

interface IbusParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  signal?: AbortSignal;
  options?: Record<string, unknown>;
}

function parseIbusFrame(data: Uint8Array, parseOptions: IbusParseOptions): ParseResult {
  if (parseOptions.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const profile = resolveProfile(parseOptions.options);
  const channelsEnd = channelsEndOffset(profile);
  const minLength = channelsEnd + 2;

  if (data.length < minLength) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
        details: { availableBytes: data.length, requiredBytes: minLength, profile: profile.id },
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];
  const fields: ParsedField[] = [];

  if (profile.id === 'ia6b') {
    const lengthByte = byteAt(data, 0);
    const lengthValid = lengthByte === IA6B_LENGTH_BYTE;
    fields.push({
      id: 'length',
      name: 'Length',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: lengthByte,
      valid: lengthValid,
      warnings: [],
    });
    if (!lengthValid) {
      errors.push({
        code: 'start-delimiter-not-found',
        message: ERROR_INVALID_LENGTH_BYTE,
        offset: 0,
        length: 1,
        details: { expected: IA6B_LENGTH_BYTE, actual: lengthByte },
      });
    }

    // ArduPilot bunu ZORUNLU kılıyor, Betaflight'ın RX yolu denetlemiyor —
    // bu motor Betaflight'ı izler: UYARIR, REDDETMEZ (dosya başı).
    const commandByte = byteAt(data, 1);
    const commandStandard = commandByte === IA6B_COMMAND_BYTE;
    fields.push({
      id: 'command',
      name: 'Command',
      offset: 1,
      length: 1,
      rawBytes: data.slice(1, 2),
      rawValue: commandByte,
      ...(commandStandard ? { physicalValue: 'RC Channel Command' } : {}),
      valid: true,
      warnings: commandStandard ? [] : [WARN_UNEXPECTED_COMMAND_BYTE],
    });
    if (!commandStandard) {
      warnings.push(toProtocolWarning(WARN_UNEXPECTED_COMMAND_BYTE));
    }
  } else {
    const syncByte = byteAt(data, 0);
    const syncValid = syncByte === IA6_SYNC_BYTE;
    fields.push({
      id: 'sync',
      name: 'Sync',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: syncByte,
      valid: syncValid,
      warnings: [],
    });
    if (!syncValid) {
      errors.push({
        code: 'start-delimiter-not-found',
        message: ERROR_INVALID_SYNC_BYTE,
        offset: 0,
        length: 1,
        details: { expected: IA6_SYNC_BYTE, actual: syncByte },
      });
    }
  }

  for (let index = 0; index < IBUS_CHANNEL_SLOTS; index += 1) {
    const slot = channelSlotFields(data, profile, index);
    fields.push(slot.value, slot.upperNibble);
  }
  // Üst nibble uyarısı FRAME seviyesinde TEK sefer basılır (14 alanın hepsi
  // aynı bilgiyi taşıyor; alan seviyesinde her biri KENDİ warnings'inde ayrı
  // ayrı zaten var — devralınan `decode-frame-warning` strict-mode tuzağı).
  warnings.push(toProtocolWarning(WARN_UPPER_NIBBLE_AMBIGUOUS));

  const transmittedChecksum = readTransmittedChecksum(data, channelsEnd);
  const computedChecksum = computeChecksum(data, profile);
  const checksumOk = computedChecksum === transmittedChecksum;
  fields.push({
    id: 'checksum',
    name: 'Checksum',
    offset: channelsEnd,
    length: 2,
    rawBytes: data.slice(channelsEnd, channelsEnd + 2),
    rawValue: transmittedChecksum,
    physicalValue: checksumOk ? 'PASS' : 'FAIL',
    valid: checksumOk,
    warnings: [],
  });
  if (!checksumOk) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_CHECKSUM_MISMATCH,
      offset: channelsEnd,
      length: 2,
      details: { expected: computedChecksum, actual: transmittedChecksum, profile: profile.id },
    });
  }

  if (data.length > minLength) {
    // Fazla bayt reddedilmez (aynı arabelleğin farklı profille yeniden
    // yorumlanabilmesi için — dosya başı), ama SESSİZ de geçilmez.
    warnings.push(toProtocolWarning(WARN_TRAILING_BYTES));
  }

  // i-BUS2 kapsam dışı — çerçeve içeriğine bağlı olmayan, HER ZAMAN geçerli
  // bir sınırlama, bu yüzden HER başarılı çözümde bildirilir (dosya başı).
  warnings.push(toProtocolWarning(WARN_IBUS2_OUT_OF_SCOPE));

  const rawFrame = createRawFrame(data, {
    ...(parseOptions.timestamp === undefined ? {} : { timestamp: parseOptions.timestamp }),
    ...(parseOptions.direction === undefined ? {} : { direction: parseOptions.direction }),
    ...(parseOptions.channel === undefined ? {} : { channel: parseOptions.channel }),
    metadata: { profile: profile.id },
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

export function parseIbus(data: Uint8Array, options?: Record<string, unknown>): ParseResult {
  return parseIbusFrame(data, options === undefined ? {} : { options });
}

export const ibusParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * `canParse` `context`/`decodeOptions` ALMAZ (`ProtocolParser` sözleşmesi) —
   * bu yüzden "seçili profil"i DATADAN yapısal olarak çıkarır: uzunluk 31 ise
   * iA6 kuralları, 32 ise iA6B kuralları denenir. Yalnız uzunluğa bakmak
   * YASAK (32 baytlık çerçeve depoda çok yaygın) — checksum de PASS olmalı.
   * `parse()` bunun AKSİNE otomatik tahmin YAPMAZ, kullanıcının seçtiği
   * profili UYGULAR (dosya başı).
   */
  canParse(data: Uint8Array): boolean {
    if (data.length === IA6B_FRAME_LENGTH) {
      return (
        data[0] === IA6B_LENGTH_BYTE &&
        computeIa6bChecksum(data) === readTransmittedChecksum(data, channelsEndOffset(IA6B_PROFILE))
      );
    }
    if (data.length === IA6_FRAME_LENGTH) {
      return (
        data[0] === IA6_SYNC_BYTE &&
        computeIa6Checksum(data) === readTransmittedChecksum(data, channelsEndOffset(IA6_PROFILE))
      );
    }
    return false;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: IbusParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.signal !== undefined) options.signal = context.signal;
    if (context?.options !== undefined) options.options = context.options;
    return parseIbusFrame(data, options);
  },
};

/**
 * Kanallar 1000, 1050, …, 1650 (`i×50+1000`, i=0..13); üst nibble'lar `i`
 * (0..13) — hepsi kolayca ayırt edilir. Baytlar bağımsız bir betikle
 * üretildi (`computeIa6Checksum`/`computeIa6bChecksum`in YUKARIDAKİ
 * gövdesiyle AYNI formül, elle çapraz kontrol edildi — dalga 15c disiplini,
 * `packedChannels.test.ts`teki fixture'la aynı ruh).
 */
const IA6B_TYPICAL_BYTES = Uint8Array.from([
  0x20, 0x40, 0xe8, 0x03, 0x1a, 0x14, 0x4c, 0x24, 0x7e, 0x34, 0xb0, 0x44, 0xe2, 0x54, 0x14, 0x65,
  0x46, 0x75, 0x78, 0x85, 0xaa, 0x95, 0xdc, 0xa5, 0x0e, 0xb6, 0x40, 0xc6, 0x72, 0xd6, 0x37, 0xf3,
]);

const IA6B_NON_STANDARD_COMMAND_BYTES = Uint8Array.from([
  0x20, 0x08, 0xe8, 0x03, 0x1a, 0x14, 0x4c, 0x24, 0x7e, 0x34, 0xb0, 0x44, 0xe2, 0x54, 0x14, 0x65,
  0x46, 0x75, 0x78, 0x85, 0xaa, 0x95, 0xdc, 0xa5, 0x0e, 0xb6, 0x40, 0xc6, 0x72, 0xd6, 0x6f, 0xf3,
]);

/** `IA6B_TYPICAL_BYTES`in AYNISI, yalnız checksum'ın ilk baytı bozuldu (0x37 → 0xC8). */
const IA6B_CHECKSUM_MISMATCH_BYTES = Uint8Array.from([
  0x20, 0x40, 0xe8, 0x03, 0x1a, 0x14, 0x4c, 0x24, 0x7e, 0x34, 0xb0, 0x44, 0xe2, 0x54, 0x14, 0x65,
  0x46, 0x75, 0x78, 0x85, 0xaa, 0x95, 0xdc, 0xa5, 0x0e, 0xb6, 0x40, 0xc6, 0x72, 0xd6, 0xc8, 0xf3,
]);

const IA6_TYPICAL_BYTES = Uint8Array.from([
  0x55, 0xe8, 0x03, 0x1a, 0x14, 0x4c, 0x24, 0x7e, 0x34, 0xb0, 0x44, 0xe2, 0x54, 0x14, 0x65, 0x46,
  0x75, 0x78, 0x85, 0xaa, 0x95, 0xdc, 0xa5, 0x0e, 0xb6, 0x40, 0xc6, 0x72, 0xd6, 0x76, 0xf8,
]);

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'ia6b-typical',
    name: 'protocol.ibus.example.ia6bTypical.name',
    bytes: IA6B_TYPICAL_BYTES,
    description: 'protocol.ibus.example.ia6bTypical.description',
    expectedValid: true,
  },
  {
    id: 'ia6b-non-standard-command',
    name: 'protocol.ibus.example.ia6bNonStandardCommand.name',
    // Komut baytı 0x40 değil (0x08) — checksum bu baytı da kapsadığı için
    // YENİDEN hesaplandı ve PASS ediyor; yalnız uyarı tetiklenir.
    bytes: IA6B_NON_STANDARD_COMMAND_BYTES,
    description: 'protocol.ibus.example.ia6bNonStandardCommand.description',
    expectedValid: true,
  },
  {
    id: 'ia6b-checksum-mismatch',
    name: 'protocol.ibus.example.ia6bChecksumMismatch.name',
    bytes: IA6B_CHECKSUM_MISMATCH_BYTES,
    description: 'protocol.ibus.example.ia6bChecksumMismatch.description',
    expectedValid: false,
  },
  {
    id: 'ia6-typical',
    name: 'protocol.ibus.example.ia6Typical.name',
    bytes: IA6_TYPICAL_BYTES,
    description: 'protocol.ibus.example.ia6Typical.description',
    expectedValid: true,
  },
];

export const ibusPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: ibusParser,
  decodeOptions: DECODE_OPTIONS,
  documentation: {
    summary: 'protocol.ibus.documentation.summary',
    layer: 'data-link',
    references: [
      {
        title: 'Betaflight — rx/ibus.c, telemetry/ibus_shared.c',
        url: 'https://github.com/betaflight/betaflight/blob/master/src/main/rx/ibus.c',
      },
      {
        title: 'ArduPilot — AP_RCProtocol_IBUS.cpp (bağımsız ikinci kaynak)',
        url: 'https://github.com/ArduPilot/ardupilot/blob/master/libraries/AP_RCProtocol/AP_RCProtocol_IBUS.cpp',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
