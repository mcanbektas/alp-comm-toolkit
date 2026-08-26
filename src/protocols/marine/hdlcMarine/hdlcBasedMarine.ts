/**
 * HDLC-Based Marine — denizcilikte tanınmayan/vendor'a özel HDLC-benzeri bit
 * çerçevelemesi (Faz 10, dalga 16a). Bu dosya `hdlcCore.ts`nin (Faz 10 dalga
 * 10c, PAYLAŞILAN çekirdek) ÜÇÜNCÜ tüketicisidir — `hdlc.ts`/`sdlc.ts`nin
 * ardından.
 *
 * ── NEDEN `hdlcCore.ts` TÜKETİLİYOR, KOPYALANMIYOR ──────────────────────────
 * Depo iki sınıf ayırt ediyor: `xcpPacket.ts` sınıfı (iki kayıt AYNI teli
 * okuyor, çekirdek GERÇEKTEN ortak → PAYLAŞ) ve `ccp.ts` sınıfı (benzer
 * GÖRÜNÜYOR ama çekirdek ortak DEĞİL → ayrı tut). Burası birincisi: bu kaydın
 * girdisi `hdlc`/`sdlc` ile BİREBİR AYNI bit-destuff edilmiş mantıksal
 * çerçevedir (Flag 0x7E … 0x7E, ISO/IEC 13239 temel yapısı) — `sdlc.ts`nin
 * kendi dosya başında yazdığı gibi tek fark alan ADI/yorumudur. Burada değişen
 * her alanın "candidate" kalmasıdır (aşağıya bak). `hdlcCore.ts`e TEK BİR
 * SATIR bile eklenmedi — iki mevcut tüketici (`hdlc.ts`, `sdlc.ts`) ve
 * testleri dokunulmadan kaldı; ek ihtiyaçlar (yapılandırılabilir FCS
 * profili/bayt sırası/kapsamı) bu dosyada YEREL fonksiyonlarla karşılandı.
 *
 * ── `CRC16_X25` NEDEN DOĞRU GİRİŞ — SAHTE DOSTLAR ───────────────────────────
 * Katalogda poly `0x1021` olan DÖRT giriş var, yalnız BİRİ HDLC FCS'idir:
 *   - `CRC16_CCITT_FALSE` (`crcCatalogue.ts:143`) — init 0xFFFF, xorout 0x0000,
 *     check 0x29B1. HDLC DEĞİL.
 *   - `CRC16_XMODEM` (`:151`) — init 0x0000, xorout 0x0000, check 0x31C3.
 *     HDLC DEĞİL.
 *   - `CRC16_X25` (`:159`) — init 0xFFFF, xorout 0xFFFF, check 0x906E.
 *     Reveng adı "CRC-16/IBM-SDLC" (alias CRC-16/ISO-HDLC, CRC-16/X-25) —
 *     BU.
 *   - `CRC16_KERMIT` (`:207`) — init 0x0000, xorout 0x0000, check 0x2189.
 *     HDLC DEĞİL.
 * Dördü de hata VERMEDEN yanlış sonuç üretir ("aynı polinom aynı algoritma
 * DEĞİLDİR" — dalga 13 dersi 2). `crcEngine.test.ts:36`teki doğrulanmış check
 * (`0x906E`) `CRC16_X25`i `hdlcCore.ts` üzerinden zaten fixture'lıyor.
 *
 * ── `0xF0B8` BİR RESIDUE'DİR, CHECK DEĞİL — VE NEDEN KULLANILMADI ───────────
 * RFC 1662 Ek C.2: `PPPGOODFCS16 = 0xf0b8` — FCS DAHİL tüm çerçeve üzerinde,
 * SON XOR uygulanmadan kalan artık (residue). `0x906E` ("123456789" check,
 * son XOR UYGULANMIŞ) ile KARIŞTIRILMAZ; `0x1D0F` aynı residue'nün
 * yansıtılmamış biçimidir (burada YOK, `CRC16_GENIBUS`); `0x0F47` residue'ye
 * yanlışlıkla `xorout` uygulanmış hâlidir (HİÇBİR YERDE geçerli değil, hata
 * olur). Bu dosya `validateConfigurableHdlcFcs` ile HESAPLA-VE-KARŞILAŞTIR
 * yolunu kullanır (`crcEngine.ts`teki `crc()` zaten `xorout` uyguladığı için
 * residue yolu buradan doğrudan `0xF0B8` ÜRETMEZ — `0x0F47` çıkar). Residue
 * yolu bu yüzden EKLENMEDİ; hesapla-ve-karşılaştır tek doğru yoldur.
 *
 * ── `canParse` NEDEN DAİMA `false` — ÖLÇÜLDÜ ────────────────────────────────
 * Doğal imza `n ≥ 5 && b[0] === 0x7E && b[n-1] === 0x7E` — bu `hdlc.ts`nin ve
 * `sdlc.ts`nin imzasının AYNISIDIR. `uavcan-compatibility` (15b) emsali
 * geçerli ama SEBEP FARKLI: orada kaydın kendi teli YOKTU; burada tel VAR,
 * sorun onun `hdlc`inkiyle AYIRT EDİLEMEZ olmasıdır. Ana brif ölçümü (140
 * kayıt / 870 örnek çerçeve, 2026-08-26): bu imza **6/870** çakışma verdi ve
 * altısı da `hdlc`/`sdlc` kayıtlarının KENDİ örnekleriydi
 * (`hdlc/i-frame(8B)`, `hdlc/s-frame(6B)`, `hdlc/u-frame(6B)`,
 * `sdlc/i-frame(8B)`, `sdlc/poll(6B)`, `sdlc/u-frame(6B)`). `true` dönmek
 * otomatik algılamada bu iki ÇALIŞAN kaydın çerçevesini ÇALARDI — kullanıcı
 * bu sayfayı AÇIKÇA seçer, çünkü sayfanın varlık sebebi zaten "vendor'ı
 * bilinmeyen çerçeve"dir. Bekçi: `hdlcMarineCanParseRegistry.test.ts`.
 *
 * ── KARAR 16a-1 — control field VARSAYILAN OLARAK "candidate" kalır ────────
 * Katalog şart koşuyor (`marine-navigation.ts`, `hdlc-based-marine` notu):
 * "Şema yüklenmeden alan adı ÜRETİLMEZ — yanlış kesinlik bu bölümde en büyük
 * risk; her alan 'candidate' olarak işaretli kalır." Spec'in kendi örnek
 * yakalaması da (`05-denizcilik.md:270`) alanları böyle adlandırıyor: "Flag
 * Valid, Address `0x12` candidate, Control `0x03` candidate, Payload
 * `18 04 20 10 33 88`, FCS candidate CRC-16". Bu yüzden Address/Control/FCS
 * "(candidate)" etiketi taşır, Flag (kesin sync baytı) ve Information (ham
 * payload, yorum iddiası yok) taşımaz. `controlFieldProfile: 'raw-candidate'`
 * (VARSAYILAN) control baytını HAM basar, I/S/U çözümü YAPMAZ —
 * `controlFieldNotInterpreted` uyarısıyla. `'iso-13239-modulo8'` seçilirse
 * `hdlcCore.ts`nin (DEĞİŞTİRİLMEMİŞ) `decodeControlByte`si çağrılır, ama
 * alan adları YİNE "(candidate)" taşır — hangi PROFİLİ vendor'ın kullandığı
 * hâlâ bir varsayımdır, motorun eksiği değil.
 *
 * ── AIS — denizcilikte BULUNAN TEK sağlam HDLC bağı, AMA `ais.ts` AYRI ─────
 * ITU-R M.1371-6 (02/2026) Ek 2 §A2-3.2.2: AIS'in VDL katmanı ISO/IEC 13239
 * HDLC'ye dayanır ve "Information packets (I-Packets) kullanılır, control
 * alanı OMİTTED (atlanır)" der; §A2-3.2.2.6 FCS'in YALNIZ veri kısmını
 * kapsadığını söyler. Bu YÜZDEN `addressFieldBytes: 0`, `controlFieldBytes: 0`
 * ve `fcsCoverage: 'information-only'` UYDURMA esneklik değil, belgelenmiş
 * bir denizcilik vakasıdır. AMA depodaki `ais.ts` bu motoru TÜKETMEZ ve
 * `related` bağı da EKLENMEDİ: `ais.ts`in girdisi `!AIVDM`/`!AIVDO` NMEA
 * TAŞIMA CÜMLESİDİR (ASCII, 6-bit armored), VDL bit akışı DEĞİL. AIS VDL'inin
 * ham bitlerini bir `exampleFrame` yapmak da CAZİP ama YAPILMADI: 168 bit tam
 * bayt değil (LSB-first oktet + NRZI), bu motorun sözleşmesi bayt-hizalı
 * mantıksal çerçevedir. Bağ yalnız sayfa dokümantasyon metninde anlatılır
 * (`documentation.summary`).
 *
 * ── YEDİ `decodeOptions` KANALI — HER BİRİNİN KAYNAĞI ───────────────────────
 * `fcsProfile` — spec özeti (`02-framing-protokolleri.md` §HDLC/FCS) üç şıkkı
 *   adıyla sayıyor: "CRC-16 profile, CRC-32 profile, Custom HDLC FCS".
 *   `crc32-iso-hdlc` katalogdaki `CRC32` girişidir (poly 0x04C11DB7, check
 *   0xCBF43926 — reveng adı BİREBİR "CRC-32/ISO-HDLC", CLAUDE.md'nin kendi
 *   CRC32 fixture'ı). `none` FCS'siz vendor çerçevelerini kapsar.
 * `fcsByteOrder` — RFC 1662 §3.1 "FCS is transmitted least significant octet
 *   first" (`hdlcCore.ts` bunu sabit varsayıyor) ama vendor çerçeveleri
 *   sapabilir; `bacnetmstp.ts:358` emsali (little/big-endian seçimi).
 * `addressFieldBytes` — ITU-T Q.921 §3.3.1 EA (Address Extension) biti
 *   adresi 2 bayta çıkarır; AIS'in VDL'i (yukarıda) adres alanını HİÇ
 *   kullanmaz → `0` gerçek bir vakadır.
 * `controlFieldBytes` — modulo-8 (1 bayt) / modulo-128 (2 bayt, Wireshark
 *   `packet-xdlc.h:99`: `XDLC_CONTROL_LEN` — U-frame'ler modulo-128'de bile
 *   1 bayt KALIR, istisna bu dosyada byte-sınırı hesabında UYGULANIR); AIS
 *   control alanını TAMAMEN ATAR → `0`.
 * `controlFieldProfile` — Karar 16a-1 (yukarıda).
 * `escaping` — senkron HDLC (`hdlcSyncExtractor`, kaçışsız) ile async/PPP-tipi
 *   HDLC (`hdlcFlagExtractor`, RFC 1662 §4.2 kaçış: Escape=0x7D, XOR=0x20)
 *   AYRI çerçeveleme mekanizmalarıdır — `hdlcCore.ts` dosya başının UYARDIĞI
 *   "yanlış araç" tuzağının ikinci ucu: senkron veride `hdlcFlagExtractor`
 *   kullanmak da YANLIŞTIR, çünkü kaçış çözümü rastgele bir veri baytını
 *   (`0x7D` sıradan bir bayt olabilir) bozar. Seçildiğinde kaçış çözümü
 *   VERİYİ DEĞİŞTİRİR ve tel offsetleri ile mantıksal offsetler AYRIŞIR
 *   (`delimiterBasedProtocol.ts`teki `hdlcFlagExtractor` kullanımı — motor
 *   ÇÖZÜLMÜŞ/unescaped içerik döndürür, tel üzerindeki kaçış olaylarını AYRICA
 *   bulmak gerekir); bu yüzden `asyncEscapingAssumed` KOŞULSUZ uyarısı
 *   basılır ve alan `offset`leri bu modda MANTIKSAL (unescaped içerik +
 *   başlangıç bayrağı) konumlardır, `ppp.ts`nin tam tel-geri-eşleme
 *   ayrıntısına GİRİLMEDİ — bu kaydın tüm alanları zaten "candidate"ken
 *   ikincil bir seçenek için o karmaşıklık orantısız olurdu; uyarı bunu
 *   AÇIKÇA söyler.
 * `fcsCoverage` — M.1371-6 §A2-3.2.2.6 AIS FCS'inin yalnız veri kısmını
 *   kapsadığını söylüyor; `address-control-information` ISO 13239'un
 *   genel/varsayılan kapsamıdır.
 *
 * ── ROZET NEDEN `ready` (kullanıcı kararı, 2026-08-26) ───────────────────────
 * `hdlcCore.ts`nin iki mevcut tüketicisi de (`hdlc`, `sdlc`) `ready` ve aynı
 * sınırları taşıyor (bit-stuffing görünümü yok, U-frame komut adları yok).
 * Denizcilikte kanonik TEK bir HDLC teli olmaması bu kaydın motorunun
 * eksikliği değil, protokolün KENDİSİDİR: çerçeve SINIRLARI, FCS DOĞRULAMASI
 * ve alan OFSETLERİ kesin çözülüyor, belirsiz olan yalnız alanların ANLAMI —
 * ve bu belirsizlik "(candidate)" etiketiyle açıkça raporlanıyor
 * (`profibusDp.ts`/`hart.ts`in "envelope'un HER alanı doğrulanıyor, ham
 * kalanlar YAPISAL eksik değil" ölçütü, `plan-fazlar.md` 13h notu).
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
import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { hdlcFlagExtractor } from '@/protocol-core/framing/hdlcFraming';
import type { FrameExtractor } from '@/protocol-core/framing/types';
import {
  byteAt,
  classifyControlByte,
  decodeControlByte,
  encodeHdlcSyncFrame,
  hdlcSyncExtractor,
  hexByte,
  hexString,
  hexWord,
} from '../../serial/framing/hdlcCore';
import { mapFramingError } from '../../serial/framing/framingErrorMapping';

const PROTOCOL_ID = 'hdlc-based-marine';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md); katalog kaydıyla BİREBİR aynı. */
const PROTOCOL_DISPLAY_NAME = 'HDLC-Based Marine';

const TRANSLATION_KEY_PREFIX = 'protocol.hdlcBasedMarine';

const ERROR_EMPTY_FRAME = `${TRANSLATION_KEY_PREFIX}.error.emptyFrame`;
const ERROR_NO_DELIMITER = `${TRANSLATION_KEY_PREFIX}.error.noDelimiter`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.error.tooShort`;
const ERROR_FCS_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.fcsMismatch`;
const WARN_TRAILING_BYTES = `${TRANSLATION_KEY_PREFIX}.warning.trailingBytes`;
const WARN_CONTROL_FIELD_NOT_INTERPRETED = `${TRANSLATION_KEY_PREFIX}.warning.controlFieldNotInterpreted`;
const WARN_EXTENDED_CONTROL_NOT_INTERPRETED = `${TRANSLATION_KEY_PREFIX}.warning.extendedControlNotInterpreted`;
const WARN_ASYNC_ESCAPING_ASSUMED = `${TRANSLATION_KEY_PREFIX}.warning.asyncEscapingAssumed`;

function toProtocolWarning(code: string): ProtocolWarning {
  return { code, message: code };
}

function frameFormatLabel(format: 'i-format' | 's-format' | 'u-format'): string {
  return format === 'i-format' ? 'I-format' : format === 's-format' ? 'S-format' : 'U-format';
}

// ── decodeOptions — kanal kimlikleri ve şıkları ─────────────────────────────

const OPTION_FCS_PROFILE = 'fcsProfile';
const OPTION_FCS_BYTE_ORDER = 'fcsByteOrder';
const OPTION_ADDRESS_FIELD_BYTES = 'addressFieldBytes';
const OPTION_CONTROL_FIELD_BYTES = 'controlFieldBytes';
const OPTION_CONTROL_FIELD_PROFILE = 'controlFieldProfile';
const OPTION_ESCAPING = 'escaping';
const OPTION_FCS_COVERAGE = 'fcsCoverage';

const FCS_PROFILE_CRC16_X25 = 'crc16-x25';
const FCS_PROFILE_CRC32_ISO_HDLC = 'crc32-iso-hdlc';
const FCS_PROFILE_NONE = 'none';
const FCS_PROFILE_VALUES = [FCS_PROFILE_CRC16_X25, FCS_PROFILE_CRC32_ISO_HDLC, FCS_PROFILE_NONE] as const;
type FcsProfile = (typeof FCS_PROFILE_VALUES)[number];

const BYTE_ORDER_LITTLE_ENDIAN = 'little-endian';
const BYTE_ORDER_BIG_ENDIAN = 'big-endian';
const BYTE_ORDER_VALUES = [BYTE_ORDER_LITTLE_ENDIAN, BYTE_ORDER_BIG_ENDIAN] as const;
type FcsByteOrder = (typeof BYTE_ORDER_VALUES)[number];

/** Q.921 EA biti / AIS'in "hiç kullanma" vakası — üç şık da gerçek bir kaynağa dayanır (dosya başı). */
const ALLOWED_FIELD_WIDTHS: readonly number[] = [0, 1, 2];

const CONTROL_PROFILE_RAW_CANDIDATE = 'raw-candidate';
const CONTROL_PROFILE_ISO_13239_MODULO8 = 'iso-13239-modulo8';
const CONTROL_PROFILE_VALUES = [CONTROL_PROFILE_RAW_CANDIDATE, CONTROL_PROFILE_ISO_13239_MODULO8] as const;

const ESCAPING_NONE = 'none';
const ESCAPING_RFC1662_OCTET_STUFFED = 'rfc1662-octet-stuffed';
const ESCAPING_VALUES = [ESCAPING_NONE, ESCAPING_RFC1662_OCTET_STUFFED] as const;

const FCS_COVERAGE_ADDRESS_CONTROL_INFORMATION = 'address-control-information';
const FCS_COVERAGE_INFORMATION_ONLY = 'information-only';
const FCS_COVERAGE_VALUES = [FCS_COVERAGE_ADDRESS_CONTROL_INFORMATION, FCS_COVERAGE_INFORMATION_ONLY] as const;

const FCS_LENGTH_BY_PROFILE: Readonly<Record<FcsProfile, number>> = {
  [FCS_PROFILE_CRC16_X25]: 2,
  [FCS_PROFILE_CRC32_ISO_HDLC]: 4,
  [FCS_PROFILE_NONE]: 0,
};

const FIELD_WIDTH_CHOICES = [
  { value: '0', label: `${TRANSLATION_KEY_PREFIX}.option.width.zeroBytes` },
  { value: '1', label: `${TRANSLATION_KEY_PREFIX}.option.width.oneByte` },
  { value: '2', label: `${TRANSLATION_KEY_PREFIX}.option.width.twoBytes` },
] as const;

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_FCS_PROFILE,
    label: `${TRANSLATION_KEY_PREFIX}.option.fcsProfile`,
    kind: 'select',
    defaultValue: FCS_PROFILE_CRC16_X25,
    description: `${TRANSLATION_KEY_PREFIX}.option.fcsProfile.description`,
    choices: [
      { value: FCS_PROFILE_CRC16_X25, label: `${TRANSLATION_KEY_PREFIX}.option.fcsProfile.crc16X25` },
      { value: FCS_PROFILE_CRC32_ISO_HDLC, label: `${TRANSLATION_KEY_PREFIX}.option.fcsProfile.crc32IsoHdlc` },
      { value: FCS_PROFILE_NONE, label: `${TRANSLATION_KEY_PREFIX}.option.fcsProfile.none` },
    ],
  },
  {
    id: OPTION_FCS_BYTE_ORDER,
    label: `${TRANSLATION_KEY_PREFIX}.option.fcsByteOrder`,
    kind: 'select',
    defaultValue: BYTE_ORDER_LITTLE_ENDIAN,
    description: `${TRANSLATION_KEY_PREFIX}.option.fcsByteOrder.description`,
    choices: [
      { value: BYTE_ORDER_LITTLE_ENDIAN, label: `${TRANSLATION_KEY_PREFIX}.option.fcsByteOrder.littleEndian` },
      { value: BYTE_ORDER_BIG_ENDIAN, label: `${TRANSLATION_KEY_PREFIX}.option.fcsByteOrder.bigEndian` },
    ],
  },
  {
    id: OPTION_ADDRESS_FIELD_BYTES,
    label: `${TRANSLATION_KEY_PREFIX}.option.addressFieldBytes`,
    kind: 'select',
    defaultValue: '1',
    description: `${TRANSLATION_KEY_PREFIX}.option.addressFieldBytes.description`,
    choices: FIELD_WIDTH_CHOICES,
  },
  {
    id: OPTION_CONTROL_FIELD_BYTES,
    label: `${TRANSLATION_KEY_PREFIX}.option.controlFieldBytes`,
    kind: 'select',
    defaultValue: '1',
    description: `${TRANSLATION_KEY_PREFIX}.option.controlFieldBytes.description`,
    choices: FIELD_WIDTH_CHOICES,
  },
  {
    id: OPTION_CONTROL_FIELD_PROFILE,
    label: `${TRANSLATION_KEY_PREFIX}.option.controlFieldProfile`,
    kind: 'select',
    defaultValue: CONTROL_PROFILE_RAW_CANDIDATE,
    description: `${TRANSLATION_KEY_PREFIX}.option.controlFieldProfile.description`,
    choices: [
      {
        value: CONTROL_PROFILE_RAW_CANDIDATE,
        label: `${TRANSLATION_KEY_PREFIX}.option.controlFieldProfile.rawCandidate`,
      },
      {
        value: CONTROL_PROFILE_ISO_13239_MODULO8,
        label: `${TRANSLATION_KEY_PREFIX}.option.controlFieldProfile.iso13239Modulo8`,
      },
    ],
  },
  {
    id: OPTION_ESCAPING,
    label: `${TRANSLATION_KEY_PREFIX}.option.escaping`,
    kind: 'select',
    defaultValue: ESCAPING_NONE,
    description: `${TRANSLATION_KEY_PREFIX}.option.escaping.description`,
    choices: [
      { value: ESCAPING_NONE, label: `${TRANSLATION_KEY_PREFIX}.option.escaping.none` },
      {
        value: ESCAPING_RFC1662_OCTET_STUFFED,
        label: `${TRANSLATION_KEY_PREFIX}.option.escaping.rfc1662OctetStuffed`,
      },
    ],
  },
  {
    id: OPTION_FCS_COVERAGE,
    label: `${TRANSLATION_KEY_PREFIX}.option.fcsCoverage`,
    kind: 'select',
    defaultValue: FCS_COVERAGE_ADDRESS_CONTROL_INFORMATION,
    description: `${TRANSLATION_KEY_PREFIX}.option.fcsCoverage.description`,
    choices: [
      {
        value: FCS_COVERAGE_ADDRESS_CONTROL_INFORMATION,
        label: `${TRANSLATION_KEY_PREFIX}.option.fcsCoverage.addressControlInformation`,
      },
      { value: FCS_COVERAGE_INFORMATION_ONLY, label: `${TRANSLATION_KEY_PREFIX}.option.fcsCoverage.informationOnly` },
    ],
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

/** `iec101.ts`teki `readWidthChoice` emsali — genişlik şıkları string olarak taşınır. */
function readFieldWidth(options: Record<string, unknown> | undefined, id: string, fallback: number): number {
  const raw = options?.[id];
  if (typeof raw !== 'string') return fallback;
  const parsed = Number(raw);
  return ALLOWED_FIELD_WIDTHS.includes(parsed) ? parsed : fallback;
}

// ── FCS — yapılandırılabilir profil/bayt sırası/kapsam ──────────────────────
// `hdlcCore.ts`teki `validateHdlcFcs` CRC16_X25 + little-endian'a SABİTTİR ve
// DEĞİŞTİRİLMEDİ (iki mevcut tüketiciyi bozmamak için); bu üç kanal
// (`fcsProfile`/`fcsByteOrder`/`fcsCoverage`) bu dosyaya ÖZGÜ, hdlcCore'un
// PAYLAŞILAN `computeNamedCrc`sini doğrudan kullanan yerel bir genelleme.

interface HdlcMarineFcsOutcome {
  readonly received: number;
  readonly calculated: number;
  readonly valid: boolean;
}

/** Toplama/çarpma ile okur (bitwise DEĞİL) — CRC32'nin en yüksek baytı 32-bit imzalı tamsayı sınırını aşabilir. */
function readUnsignedLittleEndian(bytes: Uint8Array): number {
  let value = 0;
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    value = value * 256 + byteAt(bytes, index);
  }
  return value;
}

function readUnsignedBigEndian(bytes: Uint8Array): number {
  let value = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    value = value * 256 + byteAt(bytes, index);
  }
  return value;
}

/** Yalnız `profile !== 'none'` iken çağrılır — çağıran `fcsLength > 0` ile zaten daraltmış olur. */
function validateConfigurableHdlcFcs(
  coveredBytes: Uint8Array,
  fcsBytes: Uint8Array,
  profile: FcsProfile,
  byteOrder: FcsByteOrder,
): HdlcMarineFcsOutcome {
  const crcName = profile === FCS_PROFILE_CRC32_ISO_HDLC ? 'CRC32' : 'CRC16_X25';
  const calculated = Number(computeNamedCrc(coveredBytes, crcName));
  const received =
    byteOrder === BYTE_ORDER_BIG_ENDIAN ? readUnsignedBigEndian(fcsBytes) : readUnsignedLittleEndian(fcsBytes);
  return { received, calculated, valid: received === calculated };
}

function parseHdlcBasedMarineFrame(data: Uint8Array, context?: ParseContext): ParseResult {
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

  const options = context?.options;
  const escaping = readSelectOption(options, OPTION_ESCAPING, ESCAPING_VALUES, ESCAPING_NONE);
  // TUZAK (dosya başı): kaçışsız (senkron) ve kaçışlı (async/RFC 1662) HDLC AYRI
  // çerçeveleme motorlarıdır — biri diğerinin verisini bozar, karıştırılmaz.
  const extractor: FrameExtractor = escaping === ESCAPING_RFC1662_OCTET_STUFFED ? hdlcFlagExtractor : hdlcSyncExtractor;

  const maxFrameLength = context?.maxFrameLength ?? data.length;
  const result = extractor.extract(data, { maxFrameLength });

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

  // result.status === 'complete' — content = Address+Control+Information+FCS
  // (flag'ler HARİÇ, her iki extractor'ın da ortak sözleşmesi). Kaçışlı modda
  // bu bayt DİZİSİ çözülmüş (unescaped) mantıksal içeriktir — dosya başındaki
  // `asyncEscapingAssumed` notu.
  const content = result.frame;

  const addressFieldBytes = readFieldWidth(options, OPTION_ADDRESS_FIELD_BYTES, 1);
  const controlFieldBytesSetting = readFieldWidth(options, OPTION_CONTROL_FIELD_BYTES, 1);
  const controlFieldProfile = readSelectOption(
    options,
    OPTION_CONTROL_FIELD_PROFILE,
    CONTROL_PROFILE_VALUES,
    CONTROL_PROFILE_RAW_CANDIDATE,
  );
  const fcsProfile = readSelectOption(options, OPTION_FCS_PROFILE, FCS_PROFILE_VALUES, FCS_PROFILE_CRC16_X25);
  const fcsByteOrder = readSelectOption(options, OPTION_FCS_BYTE_ORDER, BYTE_ORDER_VALUES, BYTE_ORDER_LITTLE_ENDIAN);
  const fcsCoverage = readSelectOption(
    options,
    OPTION_FCS_COVERAGE,
    FCS_COVERAGE_VALUES,
    FCS_COVERAGE_ADDRESS_CONTROL_INFORMATION,
  );

  if (content.length < addressFieldBytes) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_TOO_SHORT, offset: 1, length: content.length },
      consumedBytes: result.consumedBytes,
      recoverable: true,
    };
  }

  // Wireshark `packet-xdlc.h:99` (`XDLC_CONTROL_LEN`): modulo-128'de control 2
  // bayttır AMA U-frame'ler 1 bayt KALIR — bu bir YORUM değil, bayt-sınırı
  // hesabıdır, `controlFieldProfile`den BAĞIMSIZ uygulanır (dosya başı).
  let controlLength = 0;
  if (controlFieldBytesSetting > 0) {
    if (content.length < addressFieldBytes + 1) {
      return {
        success: false,
        error: { code: 'truncated-frame', message: ERROR_TOO_SHORT, offset: 1, length: content.length },
        consumedBytes: result.consumedBytes,
        recoverable: true,
      };
    }
    const firstControlByte = byteAt(content, addressFieldBytes);
    const layoutFormat = classifyControlByte(firstControlByte);
    controlLength = controlFieldBytesSetting === 2 && layoutFormat !== 'u-format' ? 2 : 1;
  }

  const fcsLength = FCS_LENGTH_BY_PROFILE[fcsProfile];
  const minContentLength = addressFieldBytes + controlLength + fcsLength;
  if (content.length < minContentLength) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_TOO_SHORT, offset: 1, length: content.length },
      consumedBytes: result.consumedBytes,
      recoverable: true,
    };
  }

  const addressBytes = content.slice(0, addressFieldBytes);
  const controlOffsetInContent = addressFieldBytes;
  const controlBytes = content.slice(controlOffsetInContent, controlOffsetInContent + controlLength);
  const informationStart = controlOffsetInContent + controlLength;
  const informationBytes = content.slice(informationStart, content.length - fcsLength);
  const fcsBytes = fcsLength > 0 ? content.slice(content.length - fcsLength) : undefined;
  const coveredForFcs =
    fcsCoverage === FCS_COVERAGE_INFORMATION_ONLY ? informationBytes : content.slice(0, content.length - fcsLength);

  /** content'teki bir konumu wire (`data`) offset'ine çevirir — başlangıç bayrağı her zaman `data[0]`dır. */
  const wireOffset = (contentPosition: number): number => contentPosition + 1;

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  if (escaping === ESCAPING_RFC1662_OCTET_STUFFED) {
    warnings.push(toProtocolWarning(WARN_ASYNC_ESCAPING_ASSUMED));
  }

  fields.push({
    id: 'flag-start',
    name: 'Flag',
    offset: 0,
    length: 1,
    rawBytes: data.slice(0, 1),
    rawValue: 'FLAG',
    valid: true,
    warnings: [],
  });

  if (addressFieldBytes > 0) {
    fields.push({
      id: 'address',
      name: 'Address (candidate)',
      offset: wireOffset(0),
      length: addressFieldBytes,
      rawBytes: addressBytes,
      rawValue: addressFieldBytes === 1 ? hexByte(byteAt(addressBytes, 0)) : hexString(addressBytes),
      valid: true,
      warnings: [],
    });
  }

  if (controlLength > 0) {
    if (controlFieldProfile === CONTROL_PROFILE_ISO_13239_MODULO8) {
      const firstControlByte = byteAt(controlBytes, 0);
      const cf = decodeControlByte(firstControlByte);
      const firstControlByteBytes = controlBytes.slice(0, 1);
      const controlWireOffset = wireOffset(controlOffsetInContent);

      fields.push({
        id: 'control',
        name: 'Control (candidate)',
        offset: controlWireOffset,
        length: 1,
        rawBytes: firstControlByteBytes,
        rawValue: hexByte(firstControlByte),
        physicalValue: frameFormatLabel(cf.format),
        valid: true,
        warnings: [],
      });
      fields.push({
        id: 'poll-final',
        name: 'Poll/Final (candidate)',
        offset: controlWireOffset,
        length: 1,
        rawBytes: firstControlByteBytes,
        rawValue: cf.pollFinal ? 1 : 0,
        valid: true,
        warnings: [],
      });
      if (cf.format === 'i-format') {
        fields.push({
          id: 'send-sequence-number',
          name: 'Send Sequence Number N(S) (candidate)',
          offset: controlWireOffset,
          length: 1,
          rawBytes: firstControlByteBytes,
          rawValue: cf.sendSequenceNumber ?? 0,
          valid: true,
          warnings: [],
        });
        fields.push({
          id: 'receive-sequence-number',
          name: 'Receive Sequence Number N(R) (candidate)',
          offset: controlWireOffset,
          length: 1,
          rawBytes: firstControlByteBytes,
          rawValue: cf.receiveSequenceNumber ?? 0,
          valid: true,
          warnings: [],
        });
      } else if (cf.format === 's-format') {
        fields.push({
          id: 'supervisory-type',
          name: 'Supervisory Type (candidate)',
          offset: controlWireOffset,
          length: 1,
          rawBytes: firstControlByteBytes,
          rawValue: cf.supervisoryType ?? '',
          valid: true,
          warnings: [],
        });
        fields.push({
          id: 'receive-sequence-number',
          name: 'Receive Sequence Number N(R) (candidate)',
          offset: controlWireOffset,
          length: 1,
          rawBytes: firstControlByteBytes,
          rawValue: cf.receiveSequenceNumber ?? 0,
          valid: true,
          warnings: [],
        });
      }

      if (controlLength === 2) {
        // Genişletilmiş (modulo-128) ikinci control baytı — `hdlcCore.ts`nin
        // `decodeControlByte`si BASIK moddur (dosya başı), bu bayt bit
        // seviyesinde YORUMLANMAZ, yalnız candidate ham veri olarak taşınır.
        fields.push({
          id: 'control-extended',
          name: 'Control · Extended Byte (candidate)',
          offset: wireOffset(controlOffsetInContent + 1),
          length: 1,
          rawBytes: controlBytes.slice(1, 2),
          rawValue: hexByte(byteAt(controlBytes, 1)),
          valid: true,
          warnings: [WARN_EXTENDED_CONTROL_NOT_INTERPRETED],
        });
        warnings.push(toProtocolWarning(WARN_EXTENDED_CONTROL_NOT_INTERPRETED));
      }
    } else {
      fields.push({
        id: 'control',
        name: 'Control (candidate)',
        offset: wireOffset(controlOffsetInContent),
        length: controlLength,
        rawBytes: controlBytes,
        rawValue: controlLength === 1 ? hexByte(byteAt(controlBytes, 0)) : hexString(controlBytes),
        valid: true,
        warnings: [],
      });
      warnings.push(toProtocolWarning(WARN_CONTROL_FIELD_NOT_INTERPRETED));
    }
  }

  if (informationBytes.length > 0) {
    fields.push({
      id: 'information',
      name: 'Information',
      offset: wireOffset(informationStart),
      length: informationBytes.length,
      rawBytes: informationBytes,
      rawValue: hexString(informationBytes),
      valid: true,
      warnings: [],
    });
  }

  let frameValid = true;
  if (fcsBytes !== undefined) {
    const fcsOutcome = validateConfigurableHdlcFcs(coveredForFcs, fcsBytes, fcsProfile, fcsByteOrder);
    frameValid = fcsOutcome.valid;
    const fcsWireOffset = wireOffset(content.length - fcsLength);
    fields.push({
      id: 'fcs',
      name: 'FCS (candidate)',
      offset: fcsWireOffset,
      length: fcsLength,
      rawBytes: fcsBytes,
      rawValue: hexWord(fcsOutcome.received),
      physicalValue: fcsOutcome.valid ? `PASS (${hexWord(fcsOutcome.calculated)})` : `FAIL (${hexWord(fcsOutcome.calculated)})`,
      valid: fcsOutcome.valid,
      warnings: [],
    });
    if (!fcsOutcome.valid) {
      errors.push({
        code: 'crc-mismatch',
        message: ERROR_FCS_MISMATCH,
        offset: fcsWireOffset,
        length: fcsLength,
        details: { received: fcsOutcome.received, calculated: fcsOutcome.calculated },
      });
    }
  }

  const flagEndOffset = result.consumedBytes - 1;
  fields.push({
    id: 'flag-end',
    name: 'Flag',
    offset: flagEndOffset,
    length: 1,
    rawBytes: data.slice(flagEndOffset, flagEndOffset + 1),
    rawValue: 'FLAG',
    valid: true,
    warnings: [],
  });

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
    valid: frameValid,
    errors,
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export const hdlcBasedMarineParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * DAİMA `false` — dosya başı "canParse NEDEN DAİMA false" bölümü. Girdi hiç
   * okunmaz: bu kaydın doğal imzası `hdlc`/`sdlc`ninkiyle AYNIDIR ve `true`
   * dönmek o iki çalışan kaydın çerçevesini otomatik algılamada ÇALARDI.
   * Bekçi: `hdlcMarineCanParseRegistry.test.ts`.
   */
  canParse(): boolean {
    return false;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseHdlcBasedMarineFrame(data, context);
  },
};

// ── Örnekler ───────────────────────────────────────────────────────────────
// FCS motorun KENDİSİYLE (`encodeHdlcSyncFrame` → `computeNamedCrc`) hesaplanır
// — hdlcCore.ts dosya başı disiplini: bu dosyanın test ettiği şey BAYT
// SINIRLARI, CRC algoritmasının kendisi değil. Üçü de VARSAYILAN decodeOptions
// (fcsProfile crc16-x25, addressFieldBytes 1, controlFieldBytes 1,
// controlFieldProfile raw-candidate) altında anlamlıdır.

const SPEC_EXAMPLE_ADDRESS_CONTROL_INFORMATION = Uint8Array.from([
  0x12, 0x03, 0x18, 0x04, 0x20, 0x10, 0x33, 0x88,
]);

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'unknown-marine-frame',
    // Spec'in kendi örnek yakalaması (05-denizcilik.md:270): "Unknown marine
    // HDLC protocol… 7E 12 03 18 04 20 10 33 88 XX XX 7E → Flag Valid, Address
    // 0x12 candidate, Control 0x03 candidate, Payload 18 04 20 10 33 88, FCS
    // candidate CRC-16 (conservative interpretation)." XX XX motorun kendi
    // CRC16_X25 hesabıyla dolduruldu.
    name: `${TRANSLATION_KEY_PREFIX}.example.unknownMarineFrame.name`,
    bytes: encodeHdlcSyncFrame(SPEC_EXAMPLE_ADDRESS_CONTROL_INFORMATION),
    description: `${TRANSLATION_KEY_PREFIX}.example.unknownMarineFrame.description`,
    expectedValid: true,
  },
  {
    id: 'poll-no-information',
    // Address=0xFF, Control=0x71 — Information alanı YOK (sdlc.ts'in 'poll'
    // örneğiyle aynı bayt deseni): "Information alanı boşsa basılmaz" yolunu
    // gösterir.
    name: `${TRANSLATION_KEY_PREFIX}.example.pollNoInformation.name`,
    bytes: encodeHdlcSyncFrame(Uint8Array.from([0xff, 0x71])),
    description: `${TRANSLATION_KEY_PREFIX}.example.pollNoInformation.description`,
    expectedValid: true,
  },
  {
    id: 'fcs-mismatch',
    // 'unknown-marine-frame' ile AYNI çerçeve, FCS'in düşük baytı bit bit
    // tersine çevrilmiş (sdlc.test.ts'in bozma deseniyle aynı) — FCS'in
    // GERÇEKTEN doğrulandığını (yalnız gösterilmediğini) kanıtlar.
    name: `${TRANSLATION_KEY_PREFIX}.example.fcsMismatch.name`,
    bytes: (() => {
      const wire = Uint8Array.from(encodeHdlcSyncFrame(SPEC_EXAMPLE_ADDRESS_CONTROL_INFORMATION));
      wire[wire.length - 3] = (wire[wire.length - 3] ?? 0) ^ 0xff;
      return wire;
    })(),
    description: `${TRANSLATION_KEY_PREFIX}.example.fcsMismatch.description`,
    expectedValid: false,
  },
];

export const hdlcBasedMarinePlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'marine-navigation',
  parser: hdlcBasedMarineParser,
  // 'build' sekmesi YOK (katalog) → `encoder` YAZILMAZ. `encodeHdlcSyncFrame`
  // yalnız yukarıdaki örnekleri kurmak için çağrıldı (hdlcCore.ts dosya başı:
  // "hem ProtocolPlugin.encoder'i besler hem örnek/test çerçevelerini kurar" —
  // burada yalnız ikinci rolü kullanıldı).
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'data-link',
    references: [
      {
        title: 'ISO/IEC 13239 — High-level Data Link Control (HDLC) procedures',
        url: 'https://www.iso.org/standard/37010.html',
      },
      { title: 'RFC 1662 — PPP in HDLC-like Framing', url: 'https://www.rfc-editor.org/rfc/rfc1662' },
      {
        title: 'reveng CRC Catalogue — CRC-16/IBM-SDLC (alias CRC-16/X-25)',
        url: 'https://reveng.sourceforge.io/crc-catalogue/16.htm',
      },
      {
        title: 'ITU-R M.1371-6 — AIS VDL uses HDLC per ISO/IEC 13239 (Annex 2 §A2-3.2.2)',
        url: 'https://www.itu.int/dms_pubrec/itu-r/rec/m/R-REC-M.1371-6-202602-I!!PDF-E.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};
