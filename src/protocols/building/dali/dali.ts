/**
 * DALI (Digital Addressable Lighting Interface, IEC 62386 ailesi) — forward/
 * backward çerçeve çözümü. `src/protocols/building/` ailesinin lisanslı
 * standarda geçen İLK motoru (brief-faz10-dalga6.md, 6d; 6a-6c DMX512/Art-Net/
 * sACN kamu kaynaklıydı — bu dosyanın tonu bilinçli olarak dalga 5'in
 * (dnp3.ts/iec104.ts) "lisanslı standart, ikincil sentez" disiplinine döner).
 *
 * ── KAYNAK UYARISI (Karar 2, brief-faz10-dalga6.md) ─────────────────────────
 * IEC 62386 serisinin resmi metni ÜCRETLİdir ve bu depoda YOK (dalga 5 karar
 * 2'nin aynı politikası: satın alınmaz). Aşağıdaki alan düzenleri (forward
 * frame adres baytı bit haritası, DAPC/komut ayrım biti, opcode değerleri,
 * Control/Configuration/Query kategori sınırları) İKİ bağımsız kamuya açık
 * ikincil kaynaktan ÇAPRAZ TEYİTLE alındı (2026-08-18 taranarak):
 *   1. Wikipedia "Digital Addressable Lighting Interface" maddesinin komut
 *      tablosu (Control commands/Configuration commands/Query commands üç
 *      başlıklı, hex değerli) —
 *      https://en.wikipedia.org/wiki/Digital_Addressable_Lighting_Interface
 *      (kendisi IEC 62386-102 ve DALI AG'nin kamuya açık 2001 el kitabını
 *      kaynak gösteriyor).
 *   2. `python-dali` (sde1000, LGPLv3+ — yalnız dokümante edilmiş sabitler ve
 *      format bilgisi referans alındı, KOD KOPYALANMADI; iec104.ts'in
 *      lib60870/GPLv3 emsaliyle AYNI disiplin): `dali/gear/general.py`nin
 *      `_cmdval` sabitleri (OFF=0x00, SetScene/"Store Scene"=0x40,
 *      QueryLampFailure=0x92, QueryActualLevel=0xa0, DAPC 0-254 + 255=
 *      "MASK") ve `dali/address.py`nin adresleme modeli (64 short address +
 *      16 group + broadcast) —
 *      https://github.com/sde1000/python-dali/blob/master/dali/gear/general.py
 *      https://github.com/sde1000/python-dali/blob/master/dali/address.py
 * İki kaynağın da aynı sayıyı aynı adla verdiği alanlar adlandırıldı. Adres
 * baytının "100AAAAS" (grup) / "0AAAAAAS" (kısa adres) bit haritası ayrıca
 * bir WebSearch özetinin (picotech/art-osc/oreilly kaynaklı "YAAAAAAS"
 * tanımı) verdiğiyle de örtüşüyor — üçüncü, bağımsız bir doğrulama.
 * `docs/spec/ozet/07-bina-otomasyonu.md`daki "64 control gear + 16 group"
 * (satır 151) ve "16 scene" limitleri de bit genişlikleriyle (6 bit adres,
 * 4 bit grup/sahne) birebir örtüşüyor — iç tutarlılık kanıtı.
 *
 * ── KATEGORİ SINIRLARI: KISMEN ENTERPOLE (dürüst disclosure) ────────────────
 * Control (0x00-0x1F) ve Query'nin başlangıcı (0x90 QUERY STATUS) Wikipedia
 * tablosunun KENDİ bölüm başlıklarından doğrudan okundu. Configuration'ın
 * 0x20-0x6F aralığı da Wikipedia'da doğrudan görüldü (RESET, SET SCENE, ADD
 * TO GROUP). 0x70-0x8F aralığı (REMOVE FROM GROUP, STORE DTR AS SHORT
 * ADDRESS) yalnız python-dali soyundan teyitli — bu 32 değerlik alt-aralığın
 * kategorisi TEK soydan gelir, iki BAĞIMSIZ kaynaktan değil. Yine de
 * Configuration'a atanmaları düşük risklidir: hepsi tek-yönlü ayar/adresleme
 * komutu (yanıt beklemez), Query'nin doğasıyla (her zaman bir Response
 * bekler) çelişmez.
 *
 * ── GİRDİ: 1/2/3 BAYTLIK HAM DİZİ, MANCHESTER KODLAMASI DEĞİL ───────────────
 * (lin.ts'in "NEDEN BREAK BİR BAYT DEĞİL" ile AYNI gerekçe.) DALI fiziksel
 * katmanda Manchester kodlu, çift telli bir bus sinyalidir; bit-genişliği
 * ölçümüyle algılanan bu kodlama HİÇBİR DALI alıcısında uygulamaya "bayt"
 * olarak sızmaz — decoder Manchester'ı hiç görmez, girdi doğrudan çözülmüş
 * bayt dizisidir: `[Address, Data]` (forward, 2 bayt), `[Response]`
 * (backward, 1 bayt) ya da `[B0,B1,B2]` (DALI-2 24-bit device frame, 3 bayt).
 *
 * ── UZUNLUĞA GÖRE ÜÇ DALLANMA (Karar 6) ──────────────────────────────────────
 * 1 bayt → backward frame (yanıt, ham + context-bağımlılık uyarısı).
 * 2 bayt → forward frame (16-bit: Address Byte + Opcode/Data Byte).
 * 3 bayt → DALI-2 24-bit control-device çerçevesi OLABİLİR — bu dalgaya
 *   GİRMEZ (Karar 6): "DALI-2 device frame, planned" uyarısıyla TÜM baytlar
 *   ham gösterilir, HATA değil (bilinçli kapsam dışı; IEC 62386-103'ün ayrı
 *   adresleme şeması — python-dali `address.py`: "Addressing for control
 *   devices is described in IEC 62386-103 section 7.2.1.2" — bu motora hiç
 *   girmiyor). Diğer uzunluklar (0, 4+) → hata (format tanınmıyor).
 *
 * ── ADRES BAYTI (forward frame, byte 0) ──────────────────────────────────────
 * Üst bit(ler) adres sınıfını belirler:
 *   `0 AAAAAA S` → Individual/short address (A: 6 bit, 0-63)
 *   `100 AAAA S` → Group address (A: 4 bit, 0-15)
 *   `1111111 S`  → Broadcast (0xFE/0xFF)
 * Bu üçünün DIŞINDA kalan bit deseni (ör. "101"/"110" önekli special-command
 * bölgesi — DALI-1 commissioning komutları) İKİNCİ bağımsız kaynakla bit-bit
 * teyitli değil: UYDURULMAZ, adres sınıfı "unrecognized" + ham + uyarı.
 *
 * ── Y/S BİTİ: DAPC/KOMUT AYRIMI (Address Byte'ın EN DÜŞÜK biti) ────────────
 * S=0 → 2. bayt DAPC (Direct Arc Power Control): 0-254 hedef seviye, 255
 * "MASK" (süren fade'i durdur / değişiklik yok — iki kaynakta da aynı).
 * S=1 → 2. bayt bir KOMUT opcode'udur; dar ad kümesi (SADECE spec özetinin/
 * ikincil kaynağın adlandırdığı altı komut — brief madde 9): OFF(0x00),
 * Go To Scene(0x10-0x1F, sahne=opcode-0x10), Set Fade Time(0x2E), Store
 * Scene(0x40-0x4F, sahne=opcode-0x40), Query Lamp Failure(0x92), Query
 * Actual Level(0xA0) — + Control/Configuration/Query kategorisi (Wikipedia
 * tablosunun kendi üç bölüm başlığı). Dar kümenin DIŞINDAKİ her opcode ham +
 * yalnız KATEGORİ gösterir (adı UYDURULMAZ).
 *
 * ── BACKWARD FRAME: BAĞLAMSIZ YORUM (mavlink `crcNeedsDialect` tonu) ────────
 * 8-bit yanıt hangi Query'nin cevabı olduğunu TEK BAŞINA taşımaz — bu bilgi
 * önceki forward frame'den gelir (çok-çerçeve/oturum takibi ister). Bu motor
 * TEK çerçeve parser'ıdır: değeri ham gösterir + "yorum bağlama bağlı"
 * uyarısı basar; normalize edilmiş yüzde ya da anlam UYDURMAZ (dimming view/
 * fault monitor ANALYZER işidir, bu motora girmez).
 *
 * ── CHECKSUM YOK ─────────────────────────────────────────────────────────────
 * DALI'de checksum/CRC alanı yoktur; `valid` YALNIZ yapısal (uzunluk)
 * kontrolünden gelir — PASS/FAIL doğrulama rozeti basılmaz.
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

const PROTOCOL_ID = 'dali';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'DALI';

const BACKWARD_FRAME_LENGTH = 1;
const FORWARD_FRAME_LENGTH = 2;
/** DALI-2 24-bit control-device çerçevesi — Karar 6: yapısı çözülmez, ham. */
const DALI2_DEVICE_FRAME_LENGTH = 3;
const MIN_FRAME_LENGTH = BACKWARD_FRAME_LENGTH;
const MAX_FRAME_LENGTH = DALI2_DEVICE_FRAME_LENGTH;

const HEX_RADIX = 16;

/** Address Byte'ın en düşük biti — dosya başı "Y/S biti" notu. */
const S_BIT_MASK = 0x01;
/** Bit7=0 → Individual/short address (dosya başı adres baytı notu). */
const INDIVIDUAL_TOP_BIT_MASK = 0x80;
/** Short address 6 bit genişliğinde (0-63) — ozet07:151 "64 control gear" ile örtüşür. */
const SHORT_ADDRESS_MASK = 0x3f;
/** Üst 7 bit hepsi 1 → Broadcast (0xFE/0xFF, S biti serbest). */
const BROADCAST_PREFIX_MASK = 0xfe;
const BROADCAST_PREFIX_VALUE = 0xfe;
/** Üst 3 bit "100" → Group address (dosya başı adres baytı notu). */
const GROUP_PREFIX_MASK = 0xe0;
const GROUP_PREFIX_VALUE = 0x80;
/** Group 4 bit genişliğinde (0-15) — ozet07:151 "16 group" ile örtüşür. */
const GROUP_ADDRESS_MASK = 0x0f;

/** DAPC'de 255 özel "MASK" değeridir — süren fade durur, seviye değişmez. */
const DAPC_MASK_VALUE = 255;

/** Dar opcode ad kümesi sınırları (dosya başı kaynak uyarısı). */
const OFF_OPCODE = 0x00;
const GO_TO_SCENE_MIN = 0x10;
const GO_TO_SCENE_MAX = 0x1f;
const SET_FADE_TIME_OPCODE = 0x2e;
const STORE_SCENE_MIN = 0x40;
const STORE_SCENE_MAX = 0x4f;
const QUERY_LAMP_FAILURE_OPCODE = 0x92;
const QUERY_ACTUAL_LEVEL_OPCODE = 0xa0;

/** Kategori sınırları — dosya başı "kategori sınırları: kısmen enterpole" notu. */
const CONTROL_CATEGORY_MAX = 0x1f;
const CONFIGURATION_CATEGORY_MAX = 0x8f;

const ERROR_FRAME_TOO_SHORT = 'protocol.dali.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.dali.error.frameTooLong';
const ERROR_ABORTED = 'protocol.dali.error.aborted';

const WARN_UNRECOGNIZED_ADDRESS_CLASS = 'protocol.dali.warning.unrecognizedAddressClass';
const WARN_UNRECOGNIZED_OPCODE = 'protocol.dali.warning.unrecognizedOpcode';
const WARN_BACKWARD_FRAME_CONTEXT_DEPENDENT = 'protocol.dali.warning.backwardFrameContextDependent';
const WARN_DALI2_DEVICE_FRAME_PLANNED = 'protocol.dali.warning.dali2DeviceFramePlanned';

const SUMMARY_BACKWARD_FRAME = 'protocol.dali.summary.backwardFrame';
const SUMMARY_FORWARD_DAPC = 'protocol.dali.summary.forwardDapc';
const SUMMARY_FORWARD_COMMAND = 'protocol.dali.summary.forwardCommand';
const SUMMARY_DALI2_DEVICE_FRAME = 'protocol.dali.summary.dali2DeviceFrame';

type DaliFrameKind = 'backward' | 'forward' | 'dali2-device';

export type DaliFrameMetadata = {
  frameKind: DaliFrameKind;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

type DaliAddressClass = 'individual' | 'group' | 'broadcast' | 'unrecognized';
type DaliCommandCategory = 'Control' | 'Configuration' | 'Query';

interface DaliAddressInfo {
  addressClass: DaliAddressClass;
  shortAddress?: number;
  groupAddress?: number;
}

interface DaliOpcodeInfo {
  category: DaliCommandCategory;
  /** Dar ad kümesindeyse doldurulur; yoksa yalnız kategori taşınır (dosya başı). */
  name?: string;
  /** Go To Scene / Store Scene için 0-15 sahne numarası. */
  sceneNumber?: number;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

/**
 * Address Byte'ı üç sınıftan birine ayırır (dosya başı "Adres baytı" notu).
 * Üç kalıbın dışında kalan bit deseni ikinci kaynakla teyitli değildir —
 * "unrecognized" döner, sınıf UYDURULMAZ.
 */
function classifyDaliAddress(addressByte: number): DaliAddressInfo {
  if ((addressByte & INDIVIDUAL_TOP_BIT_MASK) === 0) {
    return { addressClass: 'individual', shortAddress: (addressByte >>> 1) & SHORT_ADDRESS_MASK };
  }
  if ((addressByte & BROADCAST_PREFIX_MASK) === BROADCAST_PREFIX_VALUE) {
    return { addressClass: 'broadcast' };
  }
  if ((addressByte & GROUP_PREFIX_MASK) === GROUP_PREFIX_VALUE) {
    return { addressClass: 'group', groupAddress: (addressByte >>> 1) & GROUP_ADDRESS_MASK };
  }
  return { addressClass: 'unrecognized' };
}

function formatDaliAddressLabel(info: DaliAddressInfo): string | undefined {
  switch (info.addressClass) {
    case 'individual':
      return `Individual ${String(info.shortAddress)}`;
    case 'group':
      return `Group ${String(info.groupAddress)}`;
    case 'broadcast':
      return 'Broadcast';
    case 'unrecognized':
      return undefined;
  }
}

/** Opcode baytının kategorisi — dosya başı "kategori sınırları" notu, TÜM 0x00-0xFF'i kapsar. */
function categoryForOpcode(opcode: number): DaliCommandCategory {
  if (opcode <= CONTROL_CATEGORY_MAX) return 'Control';
  if (opcode <= CONFIGURATION_CATEGORY_MAX) return 'Configuration';
  return 'Query';
}

/**
 * Komut opcode'unu dar ad kümesiyle (brief madde 9 — SADECE bu altı isim)
 * eşler; kümenin dışındaysa yalnız kategori taşınır, ad UYDURULMAZ.
 */
function classifyDaliOpcode(opcode: number): DaliOpcodeInfo {
  const category = categoryForOpcode(opcode);
  if (opcode === OFF_OPCODE) return { category, name: 'OFF' };
  if (opcode >= GO_TO_SCENE_MIN && opcode <= GO_TO_SCENE_MAX) {
    return { category, name: 'Go To Scene', sceneNumber: opcode - GO_TO_SCENE_MIN };
  }
  if (opcode === SET_FADE_TIME_OPCODE) return { category, name: 'Set Fade Time' };
  if (opcode >= STORE_SCENE_MIN && opcode <= STORE_SCENE_MAX) {
    return { category, name: 'Store Scene', sceneNumber: opcode - STORE_SCENE_MIN };
  }
  if (opcode === QUERY_LAMP_FAILURE_OPCODE) return { category, name: 'Query Lamp Failure' };
  if (opcode === QUERY_ACTUAL_LEVEL_OPCODE) return { category, name: 'Query Actual Level' };
  return { category };
}

function formatDaliCommandLabel(info: DaliOpcodeInfo): string {
  if (info.name === undefined) return info.category;
  const label = info.sceneNumber === undefined ? info.name : `${info.name} ${String(info.sceneNumber)}`;
  return `${label} (${info.category})`;
}

/** DAPC de "Control" kategorisidir (ozet07:161 — CONTROL: ...Direct Arc Power). */
function formatDapcLabel(dataByte: number): string {
  return dataByte === DAPC_MASK_VALUE ? 'MASK (Control)' : 'Direct Arc Power Level (Control)';
}

interface DaliParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseDaliFrame(data: Uint8Array, options: DaliParseOptions): ParseResult {
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
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const maxFrameLength = options.maxFrameLength ?? MAX_FRAME_LENGTH;
  if (data.length > maxFrameLength) {
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
  // Yapısal hata yalnız yukarıdaki iki ParseFailure yolunda: checksum yok, bu
  // yüzden başarıyla kurulan her çerçeve `errors: []` ile `valid: true` döner
  // (dosya başı "Checksum yok" notu — "valid" yalnız yapısal kontrolden gelir).
  const errors: ProtocolError[] = [];

  let frameKind: DaliFrameKind;
  let summaryKey: string;
  const summaryParams: Record<string, string> = {};

  if (data.length === BACKWARD_FRAME_LENGTH) {
    frameKind = 'backward';
    const responseByte = byteAt(data, 0);
    fields.push({
      id: 'response',
      name: 'Response',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: responseByte,
      valid: true,
      warnings: [WARN_BACKWARD_FRAME_CONTEXT_DEPENDENT],
    });
    warnings.push(toProtocolWarning(WARN_BACKWARD_FRAME_CONTEXT_DEPENDENT));
    summaryKey = SUMMARY_BACKWARD_FRAME;
    summaryParams.value = String(responseByte);
  } else if (data.length === FORWARD_FRAME_LENGTH) {
    frameKind = 'forward';
    const addressByte = byteAt(data, 0);
    const dataByte = byteAt(data, 1);
    const addressInfo = classifyDaliAddress(addressByte);
    const addressLabel = formatDaliAddressLabel(addressInfo);

    const addressField: ParsedField = {
      id: 'address',
      name: 'Address',
      offset: 0,
      length: 1,
      rawBytes: data.slice(0, 1),
      rawValue: addressByte,
      valid: addressInfo.addressClass !== 'unrecognized',
      warnings: [],
    };
    if (addressLabel !== undefined) {
      addressField.physicalValue = addressLabel;
    } else {
      addressField.warnings.push(WARN_UNRECOGNIZED_ADDRESS_CLASS);
      warnings.push(toProtocolWarning(WARN_UNRECOGNIZED_ADDRESS_CLASS));
    }
    fields.push(addressField);

    const selectBit = addressByte & S_BIT_MASK;
    const dataField: ParsedField = {
      id: 'data',
      name: selectBit === 0 ? 'Direct Arc Power (DAPC)' : 'Command',
      offset: 1,
      length: 1,
      rawBytes: data.slice(1, 2),
      rawValue: dataByte,
      valid: true,
      warnings: [],
    };

    let commandLabelForSummary: string;
    if (selectBit === 0) {
      const label = formatDapcLabel(dataByte);
      dataField.physicalValue = label;
      commandLabelForSummary = label;
    } else {
      const opcodeInfo = classifyDaliOpcode(dataByte);
      const label = formatDaliCommandLabel(opcodeInfo);
      dataField.physicalValue = label;
      commandLabelForSummary = label;
      if (opcodeInfo.name === undefined) {
        dataField.valid = false;
        dataField.warnings.push(WARN_UNRECOGNIZED_OPCODE);
        warnings.push(toProtocolWarning(WARN_UNRECOGNIZED_OPCODE));
      }
    }
    fields.push(dataField);

    summaryKey = selectBit === 0 ? SUMMARY_FORWARD_DAPC : SUMMARY_FORWARD_COMMAND;
    summaryParams.address = addressLabel ?? formatHexByte(addressByte);
    summaryParams.command = commandLabelForSummary;
  } else {
    // data.length === DALI2_DEVICE_FRAME_LENGTH (3) — Karar 6: bu dalgaya girmez.
    frameKind = 'dali2-device';
    fields.push({
      id: 'dali2-device-frame',
      name: 'DALI-2 Device Frame (24-bit)',
      offset: 0,
      length: DALI2_DEVICE_FRAME_LENGTH,
      rawBytes: data.slice(0, DALI2_DEVICE_FRAME_LENGTH),
      valid: true,
      warnings: [WARN_DALI2_DEVICE_FRAME_PLANNED],
    });
    warnings.push(toProtocolWarning(WARN_DALI2_DEVICE_FRAME_PLANNED));
    summaryKey = SUMMARY_DALI2_DEVICE_FRAME;
  }

  const metadata: DaliFrameMetadata = { frameKind, summaryKey, summaryParams };

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

export function parseDali(data: Uint8Array): ParseResult {
  return parseDaliFrame(data, {});
}

export const daliParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme — yalnız uzunluk penceresi (dosya başı: DALI'nin magic
   * baytı yok, her adres/opcode değeri geçerli olabilir; dmx512.ts'in aynı
   * gerekçesi).
   */
  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_FRAME_LENGTH && data.length <= MAX_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: DaliParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseDaliFrame(data, options);
  },
};

/**
 * Örnek çerçeveler. §43'te DALI için fixture YOK (lisanslı standart, dosya
 * başı); baytlar gerçek motorla (adres/opcode formülleriyle) hesaplandı,
 * uydurulmadı. Brief madde 9 sekiz senaryoyu birebir kapsar.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'individual-dapc',
    name: 'protocol.dali.example.individualDapc.name',
    // Individual 5 (adres=(5<<1)|0=0x0A), DAPC seviye 200 (0xC8).
    bytes: Uint8Array.from([0x0a, 0xc8]),
    description: 'protocol.dali.example.individualDapc.description',
    expectedValid: true,
  },
  {
    id: 'individual-recognized-command-off',
    name: 'protocol.dali.example.individualRecognizedCommandOff.name',
    // Individual 5 (adres=(5<<1)|1=0x0B), komut OFF (0x00).
    bytes: Uint8Array.from([0x0b, 0x00]),
    description: 'protocol.dali.example.individualRecognizedCommandOff.description',
    expectedValid: true,
  },
  {
    id: 'group-command',
    name: 'protocol.dali.example.groupCommand.name',
    // Group 3 (adres=0x80|(3<<1)|1=0x87), Go To Scene 7 (0x10+7=0x17).
    bytes: Uint8Array.from([0x87, 0x17]),
    description: 'protocol.dali.example.groupCommand.description',
    expectedValid: true,
  },
  {
    id: 'broadcast-command',
    name: 'protocol.dali.example.broadcastCommand.name',
    // Broadcast (0xFF, S=1), komut OFF (0x00) — klasik "tüm ışıklar sönsün".
    bytes: Uint8Array.from([0xff, 0x00]),
    description: 'protocol.dali.example.broadcastCommand.description',
    expectedValid: true,
  },
  {
    id: 'unrecognized-opcode',
    name: 'protocol.dali.example.unrecognizedOpcode.name',
    // Individual 10 (0x15), opcode 0x01 (UP) — dar kümede YOK, kategori
    // (Control) ile ham gösterilir; adı UYDURULMAZ.
    bytes: Uint8Array.from([0x15, 0x01]),
    description: 'protocol.dali.example.unrecognizedOpcode.description',
    expectedValid: true,
  },
  {
    id: 'backward-frame-response',
    name: 'protocol.dali.example.backwardFrameResponse.name',
    bytes: Uint8Array.from([0xd2]),
    description: 'protocol.dali.example.backwardFrameResponse.description',
    expectedValid: true,
  },
  {
    id: 'dali2-device-frame',
    name: 'protocol.dali.example.dali2DeviceFrame.name',
    // 3 bayt — Karar 6 gereği yapısı çözülmez, tamamı ham + "planned" uyarısı.
    bytes: Uint8Array.from([0x81, 0x23, 0x45]),
    description: 'protocol.dali.example.dali2DeviceFrame.description',
    expectedValid: true,
  },
  {
    id: 'unrecognized-length',
    name: 'protocol.dali.example.unrecognizedLength.name',
    // 4 bayt — forward/backward/DALI-2 hiçbirine uymaz, ParseFailure.
    bytes: Uint8Array.from([0x0a, 0xc8, 0x00, 0x00]),
    description: 'protocol.dali.example.unrecognizedLength.description',
    expectedValid: false,
  },
];

export const daliPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'building-automation',
  parser: daliParser,
  documentation: {
    summary: 'protocol.dali.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'Wikipedia — Digital Addressable Lighting Interface (komut tablosu)',
        url: 'https://en.wikipedia.org/wiki/Digital_Addressable_Lighting_Interface',
      },
      {
        title: 'python-dali (sde1000, LGPLv3+ — yalnız sabitler/format referansı, kod kopyalanmadı)',
        url: 'https://github.com/sde1000/python-dali',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};
