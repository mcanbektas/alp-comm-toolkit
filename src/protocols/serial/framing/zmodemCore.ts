/**
 * ZMODEM — Faz 10 dalga 10d/2. XMODEM/YMODEM/HDLC/SDLC'nin (bu dalga)
 * HİÇBİRİNE benzemez: framing motoruna (Faz 6) UĞRAMAZ (xmodemCore.ts'in
 * gerekçesiyle aynı — stop-and-wait değil ama session/streaming bir
 * protokol, motorun 15 yöntemi bunu da karşılamıyor) VE `escaping.ts`nin
 * jenerik xorMask motoru da DOĞRUDAN kullanılamaz — ZDLE'den sonraki bayt
 * ÜÇ ayrı anlam taşıyabilir (header-tipi göstergesi / XOR'lu kaçış /
 * subpacket-bitiş işaretçisi h-i-j-k / rubout işaretçisi l-m), jenerik
 * motorun ikili "substitutions XOR xorMask" modeli bu üçünü ayırt edemez
 * (HDLC'nin (dalga 10c) `hdlcFlagExtractor`i reddetmesiyle aynı gerekçe
 * kalıbı — bkz. hdlcCore.ts dosya başı).
 *
 * **Kaynak — projenin kendi speci BOŞ:** `02-framing-protokolleri.md`
 * (satır 272-289) yalnız 7 frame adı + state machine + resume örneği
 * veriyor, bit seviyesi (ZDLE kaçışı, header formu, CRC seçimi, subpacket
 * bitiş kodları) YOK — kendi notu bunu açıkça kabul ediyor ("Dikkat
 * çekenler #9": kanonik tanım yok). Bu yüzden aşağıdaki TÜM sabitler dış
 * kaynaktan — kullanıcı kararıyla **lrzsz profili** seçildi (katalog
 * kaydının kendi notu + AskUserQuestion kararı, 2026-08-21):
 *
 * 1. Chuck Forsberg, "The ZMODEM Inter Application File Transfer Protocol"
 *    (Rev Oct-14-88, Omen Technology) — kanonik protokol speci, prose.
 * 2. `zmodem.h` — Forsberg'in KENDİ header dosyası, İKİ bağımsız mirror'da
 *    (stuff.mit.edu/.../zmodem.h, 05-23-87; github coderfordev/rzsz'nin
 *    zmodem.h'si, copyright 1993) BİREBİR aynı `#define` değerleriyle
 *    çapraz doğrulandı.
 * 3. `zm.c`/`crctab.c` (coderfordev/rzsz) — CRC init/genişlik/tel sırası
 *    KAYNAK KODDAN türetildi (aşağıda her sabitin yanında gerekçesi var).
 *
 * RLE'li varyantlar (ZBINR32/ZVBIN/ZVHEX/ZVBIN32/ZVBINR32) yalnız rzsz'nin
 * 1993 header'ında var, 1988 taban specinde YOK — lrzsz-profilinde
 * BİLEREK dışarıda bırakıldı, `unsupported-header-type` ile işaretlenir,
 * sessizce yanlış çözülmez.
 */

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';

// ── ZDLE ve header-form sabitleri (zmodem.h, iki mirror'da birebir) ─────

export const ZPAD = 0x2a;
export const ZDLE = 0x18;
export const ZDLEE = ZDLE ^ 0x40;

export const ZBIN = 0x41;
export const ZHEX = 0x42;
export const ZBIN32 = 0x43;

/** rzsz'nin RLE uzantısı (yalnız 1993 header'ında) — lrzsz-profilinde tanınır ama çözülmez. */
export const UNSUPPORTED_HEADER_TYPES: ReadonlySet<number> = new Set([
  0x44, // ZBINR32
  0x61, // ZVBIN
  0x62, // ZVHEX
  0x63, // ZVBIN32
  0x64, // ZVBINR32
]);

export type ZmodemHeaderForm = 'binary16' | 'hex16' | 'binary32';

// ── Frame type tablosu (zmodem.h "Frame types", 0-19, iki mirror'da birebir) ─

export const FRAME_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'ZRQINIT'],
  [1, 'ZRINIT'],
  [2, 'ZSINIT'],
  [3, 'ZACK'],
  [4, 'ZFILE'],
  [5, 'ZSKIP'],
  [6, 'ZNAK'],
  [7, 'ZABORT'],
  [8, 'ZFIN'],
  [9, 'ZRPOS'],
  [10, 'ZDATA'],
  [11, 'ZEOF'],
  [12, 'ZFERR'],
  [13, 'ZCRC'],
  [14, 'ZCHALLENGE'],
  [15, 'ZCOMPL'],
  [16, 'ZCAN'],
  [17, 'ZFREECNT'],
  [18, 'ZCOMMAND'],
  [19, 'ZSTDERR'],
]);

// ── Subpacket bitiş/rubout işaretçileri (zmodem.h "ZDLE sequences") ─────
// ZDLE'den sonra bu baytlardan biri gelirse XOR'lANMAZ — h/i/j/k bir
// SINIR (subpacket bitişi), l/m bir LİTERAL DEĞER (0x7F/0xFF) taşır.

export const ZCRCE = 0x68; // 'h'
export const ZCRCG = 0x69; // 'i'
export const ZCRCQ = 0x6a; // 'j'
export const ZCRCW = 0x6b; // 'k'
export const ZRUB0 = 0x6c; // 'l' — 0x7F'ye çevir
export const ZRUB1 = 0x6d; // 'm' — 0xFF'ye çevir

export const SUBPACKET_END_NAMES: ReadonlyMap<number, string> = new Map([
  [ZCRCE, 'ZCRCE — frame ends, header follows (no response unless error)'],
  [ZCRCG, 'ZCRCG — frame continues nonstop (no response unless error)'],
  [ZCRCQ, 'ZCRCQ — frame continues, ZACK expected'],
  [ZCRCW, 'ZCRCW — frame ends, ZACK expected'],
]);

/** noUncheckedIndexedAccess guard — bayt dizisi erişimi bu guard'dan geçer (xmodemCore.ts/hdlcCore.ts emsali). */
export function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

// ── CRC seçimi — zm.c/crctab.c'den türetildi ────────────────────────────
//
// **16-bit: poly 0x1021, init 0x0000, refin=false, refout=false — mevcut
// `CRC16_XMODEM` kaydıyla BİREBİR aynı.** `crctab.c`nin tablosu (0x0000,
// 0x1021, 0x2042, ...) klasik CCITT-0x1021 üretici polinomunu doğruluyor.
// Init değeri zm.c'de doğrudan görülmedi ama DOLAYLI, sağlam bir kanıtla
// türetildi: `zrbhd32` (32-bit header alma) `crc`yi header+CRC baytları
// üzerinden biriktirip `if (crc != 0xDEBB20E3)` ile karşılaştırıyor — bu
// "residue" (kalan) yöntemi, init≠0 olduğunda ZORUNLU olarak sıfırdan
// FARKLI bir sabitle karşılaştırma gerektirir (CRC32'nin init'i spec
// metninde AÇIKÇA "0xFFFFFFFF, -1 preset, inversion" — residue de buna
// göre 0xDEBB20E3, standart CRC-32/ISO-HDLC'nin bilinen "magic residue"
// değeri, `crcCatalogue.ts`teki mevcut `CRC32` kaydıyla + CLAUDE.md'nin
// kendi fixture'ıyla (123456789→0xCBF43926) UYUŞUYOR). 16-bit karşılığı
// (`zgethdr`) AYNI yöntemle `if (crc & 0xFFFF)` — yani residue TAM SIFIR
// bekliyor. CRC32'nin residue'su init'ten dolayı sıfırDIŞI olduğuna göre,
// CRC16'nın residue'sunun sıfır olması ANCAK init=0 ile mümkün (aynı
// matematiksel zorunluluk, ters yönde) — bu yüzden CRC16_XMODEM'in init'i
// (0x0000) buraya da uygulandı, ayrı bir katalog kaydı AÇILMADI.
//
// **Tel sırası — 16-bit BÜYÜK-UÇLU (xmodemCore.ts'in yansıtılmamış CRC16
// büyük-uçlu kuralıyla aynı disiplin), 32-bit KÜÇÜK-UÇLU (hdlcCore.ts'in
// yansıtılmış CRC16_X25 küçük-uçlu kuralıyla aynı disiplin — CRC32 da
// refin=refout=true, "yansıtılmış → küçük-uçlu" kuralı burada da geçerli).**
// Bu ikisi doğrudan bir gerçek ZMODEM yakalamasıyla bayt-bayt DOĞRULANMADI
// (fixture yok) — codebase'in kendi kurduğu refin/refout→endianness
// kuralından türetildi, testlerde bu türetim AÇIKÇA not edilir.

export type ZmodemCrcWidth = 16 | 32;

function calculateCrc(bytes: Uint8Array, width: ZmodemCrcWidth): number {
  return Number(computeNamedCrc(bytes, width === 16 ? 'CRC16_XMODEM' : 'CRC32'));
}

function readReceivedCrc(bytes: Uint8Array, width: ZmodemCrcWidth): number {
  if (width === 16) {
    return (byteAt(bytes, 0) << 8) | byteAt(bytes, 1);
  }
  return ((byteAt(bytes, 2) << 16) | (byteAt(bytes, 1) << 8) | byteAt(bytes, 0)) + byteAt(bytes, 3) * 0x1000000;
}

function writeCrcBytes(crcValue: number, width: ZmodemCrcWidth): number[] {
  if (width === 16) {
    return [(crcValue >> 8) & 0xff, crcValue & 0xff];
  }
  return [crcValue & 0xff, (crcValue >> 8) & 0xff, (crcValue >> 16) & 0xff, Math.floor(crcValue / 0x1000000) & 0xff];
}

// ── ZDLE kaçışı — header alanları (SAYILI uzunluk, terminatör ARANMAZ) ──

export type ZdleDecodeFailureReason = 'truncated-frame' | 'invalid-escape';

interface ZdleDecodeSuccess {
  readonly ok: true;
  readonly bytes: Uint8Array;
  readonly consumed: number;
}
interface ZdleDecodeFailure {
  readonly ok: false;
  readonly reason: ZdleDecodeFailureReason;
  readonly offset: number;
}

/**
 * `wire`i `offset`ten başlayarak ZDLE kaçışını çözüp TAM `count` mantıksal
 * bayt toplayana kadar okur. Header alanları için — subpacket'in AKSİNE
 * bir bitiş işaretçisi (h/i/j/k) ARANMAZ, uzunluk baştan bilinir
 * (TYPE+4+CRC). ZDLE'den sonra ZRUB0/ZRUB1 (0x7F/0xFF literal) ya da
 * bit6-set/bit5-reset XOR aralığı (0x40-0x5F ya da "either parity"
 * 0xC0-0xDF — `& 0x60 === 0x40` ikisini de yakalar, bit7'yi hiç sormaz)
 * dışında bir şey görülürse `invalid-escape`.
 */
function readZdleEncodedBytes(wire: Uint8Array, offset: number, count: number): ZdleDecodeSuccess | ZdleDecodeFailure {
  const out: number[] = [];
  let i = offset;
  while (out.length < count) {
    const byte = wire[i];
    if (byte === undefined) return { ok: false, reason: 'truncated-frame', offset: i };
    if (byte === ZDLE) {
      const next = wire[i + 1];
      if (next === undefined) return { ok: false, reason: 'truncated-frame', offset: i + 1 };
      if (next === ZRUB0) {
        out.push(0x7f);
        i += 2;
        continue;
      }
      if (next === ZRUB1) {
        out.push(0xff);
        i += 2;
        continue;
      }
      if ((next & 0x60) === 0x40) {
        out.push(next ^ 0x40);
        i += 2;
        continue;
      }
      return { ok: false, reason: 'invalid-escape', offset: i };
    }
    out.push(byte);
    i += 1;
  }
  return { ok: true, bytes: Uint8Array.from(out), consumed: i - offset };
}

/** Encoder tarafı — ZDLE, kontrol baytları (<0x20) ve 0x7F/0xFF'i muhafazakâr biçimde kaçışlar (spec'in minimal zorunlu kümesinden GENİŞ, ama kendi decoder'ıyla her zaman tutarlı round-trip kurar). */
function zdleEscapeBytes(bytes: Uint8Array): number[] {
  const out: number[] = [];
  for (const byte of bytes) {
    if (byte === 0x7f) {
      out.push(ZDLE, ZRUB0);
    } else if (byte === 0xff) {
      out.push(ZDLE, ZRUB1);
    } else if (byte === ZDLE || byte < 0x20) {
      out.push(ZDLE, byte ^ 0x40);
    } else {
      out.push(byte);
    }
  }
  return out;
}

// ── Header data yorumlama — yalnız spec'in AÇIKÇA verdiği alanlar ───────
// Doğrulanmamış frame type'lar için ham bayt + "bu turda çözülmedi" notu
// (YMODEM'in mtime/mode/serial'ı HAM bırakmasıyla, HDLC'nin U-frame komut
// adlarını BİLEREK adlamamasıyla aynı disiplin — ezberden uydurma yok).

const ZRINIT_FLAG_NAMES: ReadonlyArray<readonly [number, string]> = [
  [0x01, 'CANFDX (full duplex)'],
  [0x02, 'CANOVIO (overlap I/O)'],
  [0x04, 'CANBRK (can send break)'],
  [0x08, 'CANRLE (can decode RLE)'],
  [0x10, 'CANLZW (can decompress)'],
  [0x20, 'CANFC32 (32-bit CRC capable)'],
  [0x40, 'ESCCTL (expects control chars escaped)'],
  [0x80, 'ESC8 (expects 8th bit escaped)'],
];

/** ZRINIT'in ZF0'ı (header data'nın SON baytı — "TYPE F3 F2 F1 F0" tel sırası, zmodem.txt §7.3.1 Figure 2). */
export function decodeZrinitFlags(zf0: number): string[] {
  return ZRINIT_FLAG_NAMES.filter(([bit]) => (zf0 & bit) !== 0).map(([, name]) => name);
}

/** 4 baytlık header data'yı little-endian 32-bit değere çevirir — spec §7.3.1 "P0: least significant ... P3: most significant". */
export function headerDataAsPosition(data: Uint8Array): number {
  return ((byteAt(data, 2) << 16) | (byteAt(data, 1) << 8) | byteAt(data, 0)) + byteAt(data, 3) * 0x1000000;
}

function interpretHeaderData(frameType: number, data: Uint8Array): string {
  switch (frameType) {
    case 0: {
      // ZRQINIT — "ZF0 contains ZCOMMAND if the program is attempting to send a command, 0 otherwise" (§11.1).
      const zf0 = byteAt(data, 3);
      if (zf0 === 18) return 'ZF0 = ZCOMMAND (18) — sender is attempting to send a command';
      if (zf0 === 0) return 'ZF0 = 0 — normal init request';
      return `ZF0 = 0x${zf0.toString(16).padStart(2, '0')} (raw)`;
    }
    case 1: {
      // ZRINIT — "ZF0 and ZF1 contain capability flags" + "ZP0 and ZP1 contain buffer size" (§11.2).
      const bufferSize = byteAt(data, 0) | (byteAt(data, 1) << 8);
      const flags = decodeZrinitFlags(byteAt(data, 3));
      const bufferText = bufferSize === 0 ? 'unlimited (nonstop I/O)' : `${bufferSize} bytes`;
      return `Buffer: ${bufferText} | Flags: ${flags.length > 0 ? flags.join(', ') : 'none'}`;
    }
    case 2: {
      // ZSINIT — "Bit Masks for ZSINIT flags byte ZF0: TESCCTL=0100, TESC8=0200" (§11.3).
      const zf0 = byteAt(data, 3);
      const flags: string[] = [];
      if ((zf0 & 0x40) !== 0) flags.push('TESCCTL (transmitter expects ctl chars escaped)');
      if ((zf0 & 0x80) !== 0) flags.push('TESC8 (transmitter expects 8th bit escaped)');
      return `ZF0 Flags: ${flags.length > 0 ? flags.join(', ') : 'none'}`;
    }
    case 4: {
      // ZFILE — "ZF0, ZF1, and ZF2 may contain options" (§11.5) — enum değerleri (ZCBIN/ZCRESUM vb.) bu turda kaynaktan doğrulanmadı, ham bırakıldı.
      const options = [byteAt(data, 0), byteAt(data, 1), byteAt(data, 2)].map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
      return `Conversion/Management/Transport option bytes: ${options} (raw — enum values not verified from source this pass, not decoded)`;
    }
    case 3: // ZACK
    case 9: // ZRPOS
    case 10: // ZDATA
    case 11: // ZEOF
    case 13: // ZCRC
    case 17: {
      // ZFREECNT
      const value = headerDataAsPosition(data);
      return `${frameType === 17 ? 'Free bytes' : 'Position'}: ${value}`;
    }
    case 14: {
      // ZCHALLENGE — "Request sender to echo a random number in ZP0...ZP3" (§11.16/11.4).
      const value = headerDataAsPosition(data);
      return `Challenge value: ${value}`;
    }
    default:
      return '(raw — no verified field semantics for this frame type in this pass)';
  }
}

// ── Header ayrıştırma ────────────────────────────────────────────────────

export interface ZmodemWireSegment {
  readonly offset: number;
  readonly length: number;
}

/** Mantıksal alan → tel konumu eşlemesi — ZDLE kaçışı yüzünden birebir değil, decode tab'ının bayt-vurgulaması bunu kullanır. */
export interface ZmodemHeaderWireSegments {
  readonly preamble: ZmodemWireSegment; // ZPAD(lar)+ZDLE+form baytı
  readonly frameType: ZmodemWireSegment;
  readonly headerData: ZmodemWireSegment;
  readonly crc: ZmodemWireSegment;
}

export interface ZmodemHeaderInfo {
  readonly form: ZmodemHeaderForm;
  readonly frameType: number;
  readonly frameTypeName: string;
  readonly headerData: Uint8Array;
  readonly interpretation: string;
  readonly crcWidth: ZmodemCrcWidth;
  readonly crcReceived: number;
  readonly crcCalculated: number;
  readonly crcValid: boolean;
  readonly segments: ZmodemHeaderWireSegments;
  /** ZPAD(ler)den header'ın sonuna (hex formda varsa CR/LF/XON dahil) kadar tüketilen wire bayt sayısı. */
  readonly wireLength: number;
}

export type ZmodemParseFailureReason =
  | 'empty'
  | 'no-zdle'
  | 'unsupported-header-type'
  | 'unknown-header-type'
  | 'truncated-frame'
  | 'invalid-escape'
  | 'invalid-hex-digit'
  | 'unknown-frame-type';

interface HeaderParseSuccess {
  readonly ok: true;
  readonly header: ZmodemHeaderInfo;
}
interface HeaderParseFailure {
  readonly ok: false;
  readonly reason: ZmodemParseFailureReason;
  readonly offset: number;
}

const HEX_DIGIT_PATTERN = /^[0-9a-f]$/;

function parseZmodemHeader(wire: Uint8Array, startOffset: number): HeaderParseSuccess | HeaderParseFailure {
  let i = startOffset;
  while (wire[i] === ZPAD) i += 1;
  if (wire[i] !== ZDLE) return { ok: false, reason: 'no-zdle', offset: i };
  i += 1;

  const formByte = wire[i];
  if (formByte === undefined) return { ok: false, reason: 'truncated-frame', offset: i };

  let form: ZmodemHeaderForm;
  let crcWidth: ZmodemCrcWidth;
  if (formByte === ZBIN) {
    form = 'binary16';
    crcWidth = 16;
  } else if (formByte === ZHEX) {
    form = 'hex16';
    crcWidth = 16;
  } else if (formByte === ZBIN32) {
    form = 'binary32';
    crcWidth = 32;
  } else if (UNSUPPORTED_HEADER_TYPES.has(formByte)) {
    return { ok: false, reason: 'unsupported-header-type', offset: i };
  } else {
    return { ok: false, reason: 'unknown-header-type', offset: i };
  }
  i += 1;

  let logical: Uint8Array;
  let wireLength: number;
  let segments: ZmodemHeaderWireSegments;

  if (form === 'hex16') {
    const DIGIT_COUNT = 14; // (1 TYPE + 4 data + 2 CRC) × 2 hex karakter
    const digits: string[] = [];
    for (let d = 0; d < DIGIT_COUNT; d += 1) {
      const byte = wire[i + d];
      if (byte === undefined) return { ok: false, reason: 'truncated-frame', offset: i + d };
      const char = String.fromCharCode(byte);
      if (!HEX_DIGIT_PATTERN.test(char)) return { ok: false, reason: 'invalid-hex-digit', offset: i + d };
      digits.push(char);
    }
    const bytes: number[] = [];
    for (let d = 0; d < DIGIT_COUNT; d += 2) {
      bytes.push(Number.parseInt((digits[d] ?? '0') + (digits[d + 1] ?? '0'), 16));
    }
    logical = Uint8Array.from(bytes);
    // Hex formda her mantıksal bayt SABİT 2 tel karakteri — kaçış yok, segment hesabı doğrudan.
    segments = {
      preamble: { offset: startOffset, length: i - startOffset },
      frameType: { offset: i, length: 2 },
      headerData: { offset: i + 2, length: 8 },
      crc: { offset: i + 10, length: 4 },
    };
    let consumed = DIGIT_COUNT;
    // CR [LF] [XON] — bilgi taşımaz, varsa tüket (spec §7.3.1 Figure 4); yoksa da geçerli sayılır (decode tab toleransı).
    let j = i + consumed;
    if (wire[j] === 0x0d) {
      j += 1;
      if (wire[j] === 0x0a) j += 1;
    }
    if (wire[j] === 0x11) j += 1;
    consumed = j - i;
    wireLength = i + consumed - startOffset;
  } else {
    // Kaçış YÜZÜNDEN mantıksal/tel konumu birebir değil — TYPE/data/CRC'yi AYRI ayrı
    // okuyup her birinin tükettiği tel uzunluğunu segment olarak saklıyoruz (decode
    // tab'ının bayt-vurgulama görünümü doğru hizalansın diye).
    const typeResult = readZdleEncodedBytes(wire, i, 1);
    if (!typeResult.ok) return { ok: false, reason: typeResult.reason, offset: typeResult.offset };
    const dataOffset = i + typeResult.consumed;
    const dataResult = readZdleEncodedBytes(wire, dataOffset, 4);
    if (!dataResult.ok) return { ok: false, reason: dataResult.reason, offset: dataResult.offset };
    const crcOffset = dataOffset + dataResult.consumed;
    const crcResult = readZdleEncodedBytes(wire, crcOffset, crcWidth / 8);
    if (!crcResult.ok) return { ok: false, reason: crcResult.reason, offset: crcResult.offset };

    logical = Uint8Array.from([...typeResult.bytes, ...dataResult.bytes, ...crcResult.bytes]);
    segments = {
      preamble: { offset: startOffset, length: i - startOffset },
      frameType: { offset: i, length: typeResult.consumed },
      headerData: { offset: dataOffset, length: dataResult.consumed },
      crc: { offset: crcOffset, length: crcResult.consumed },
    };
    wireLength = crcOffset + crcResult.consumed - startOffset;
  }

  const frameType = byteAt(logical, 0);
  const frameTypeName = FRAME_TYPE_NAMES.get(frameType);
  if (frameTypeName === undefined) return { ok: false, reason: 'unknown-frame-type', offset: i };

  const headerData = logical.slice(1, 5);
  const crcBytesReceived = logical.slice(5);
  const crcCalculated = calculateCrc(logical.slice(0, 5), crcWidth);
  const crcReceived = readReceivedCrc(crcBytesReceived, crcWidth);

  return {
    ok: true,
    header: {
      form,
      frameType,
      frameTypeName,
      headerData,
      interpretation: interpretHeaderData(frameType, headerData),
      crcWidth,
      crcReceived,
      crcCalculated,
      segments,
      crcValid: crcReceived === crcCalculated,
      wireLength,
    },
  };
}

// ── Subpacket ayrıştırma — terminatör (h/i/j/k) ARANIR ──────────────────

export interface ZmodemSubpacketInfo {
  /** ZDLE kaçışı çözülmüş içerik (terminatör VE CRC HARİÇ). */
  readonly data: Uint8Array;
  readonly terminator?: number;
  readonly terminatorName?: string;
  /** Terminatör VE onu izleyen CRC tam okunduysa true — aksi halde `data` bulunduğu yerde kesilmiş sayılır (hata değil, uyarı). */
  readonly complete: boolean;
  readonly crcWidth: ZmodemCrcWidth;
  readonly crcReceived?: number;
  readonly crcCalculated?: number;
  readonly crcValid?: boolean;
  /** `data`nın (terminatör HARİÇ) tükettiği tel bayt sayısı — kaçış yüzünden `data.length`ten farklı olabilir. */
  readonly dataWireLength: number;
  /** Terminatör ZDLE+kod çiftinin tel uzunluğu — her zaman 2, terminatör bulunduysa. */
  readonly terminatorWireLength: number;
  /** CRC'nin tükettiği tel bayt sayısı — yalnız `complete` iken > 0. */
  readonly crcWireLength: number;
  readonly wireLength: number;
}

function scanZdleSubpacketData(wire: Uint8Array, offset: number): { data: Uint8Array; terminator?: number; consumed: number } {
  const out: number[] = [];
  let i = offset;
  while (i < wire.length) {
    const byte = wire[i];
    if (byte === undefined) break;
    if (byte === ZDLE) {
      const next = wire[i + 1];
      if (next === undefined) {
        i += 1;
        break;
      }
      if (SUBPACKET_END_NAMES.has(next)) {
        return { data: Uint8Array.from(out), terminator: next, consumed: i + 2 - offset };
      }
      if (next === ZRUB0) {
        out.push(0x7f);
        i += 2;
        continue;
      }
      if (next === ZRUB1) {
        out.push(0xff);
        i += 2;
        continue;
      }
      if ((next & 0x60) === 0x40) {
        out.push(next ^ 0x40);
        i += 2;
        continue;
      }
      // Tanınmayan ZDLE dizisi — veri burada kesiliyor sayılır, `complete=false` ile ham gösterilir.
      i += 1;
      break;
    }
    out.push(byte);
    i += 1;
  }
  return { data: Uint8Array.from(out), consumed: i - offset };
}

function parseZmodemSubpacket(wire: Uint8Array, offset: number, crcWidth: ZmodemCrcWidth): ZmodemSubpacketInfo {
  const scan = scanZdleSubpacketData(wire, offset);
  if (scan.terminator === undefined) {
    return { data: scan.data, complete: false, crcWidth, dataWireLength: scan.consumed, terminatorWireLength: 0, crcWireLength: 0, wireLength: scan.consumed };
  }

  const dataWireLength = scan.consumed - 2;
  const crcBytes = readZdleEncodedBytes(wire, offset + scan.consumed, crcWidth / 8);
  if (!crcBytes.ok) {
    return {
      data: scan.data,
      terminator: scan.terminator,
      terminatorName: SUBPACKET_END_NAMES.get(scan.terminator),
      complete: false,
      crcWidth,
      dataWireLength,
      terminatorWireLength: 2,
      crcWireLength: 0,
      wireLength: scan.consumed,
    };
  }

  const crcCalculated = calculateCrc(scan.data, crcWidth);
  const crcReceived = readReceivedCrc(crcBytes.bytes, crcWidth);

  return {
    data: scan.data,
    terminator: scan.terminator,
    terminatorName: SUBPACKET_END_NAMES.get(scan.terminator),
    complete: true,
    crcWidth,
    crcReceived,
    crcCalculated,
    crcValid: crcReceived === crcCalculated,
    dataWireLength,
    terminatorWireLength: 2,
    crcWireLength: crcBytes.consumed,
    wireLength: scan.consumed + crcBytes.consumed,
  };
}

// ── Üst seviye — header + (varsa) subpacket ─────────────────────────────

export interface ZmodemFrame {
  readonly header: ZmodemHeaderInfo;
  readonly subpacket?: ZmodemSubpacketInfo;
  readonly consumedBytes: number;
}

export type ZmodemParseResult = { readonly ok: true; readonly frame: ZmodemFrame } | { readonly ok: false; readonly reason: ZmodemParseFailureReason; readonly offset: number };

/**
 * "0 or more data subpackets will follow depending on the frame type"
 * (spec §7.3.1/7.3.2) — TÜR bazlı bir izin listesi ÇIKARILMADI, header
 * sonrası wire'da bayt kaldıysa jenerik olarak BİR subpacket denenir
 * (HDLC'nin (dalga 10c) yapısal olarak tamamlanmış çerçeveden sonra kalan
 * baytları hata değil `trailing-bytes` uyarısı sayma toleransıyla aynı
 * disiplin).
 */
export function parseZmodemFrame(wire: Uint8Array): ZmodemParseResult {
  if (wire.length === 0) return { ok: false, reason: 'empty', offset: 0 };

  const headerResult = parseZmodemHeader(wire, 0);
  if (!headerResult.ok) return headerResult;

  const { header } = headerResult;
  const afterHeader = header.wireLength;

  if (afterHeader >= wire.length) {
    return { ok: true, frame: { header, consumedBytes: afterHeader } };
  }

  const subpacket = parseZmodemSubpacket(wire, afterHeader, header.crcWidth);
  return { ok: true, frame: { header, subpacket, consumedBytes: afterHeader + subpacket.wireLength } };
}

// ── Kodlayıcı — hem plugin.encoder'ı besler hem örnek çerçeveleri kurar ──
// (xmodemCore.ts'in `encodeXmodemBlock`/hdlcCore.ts'in `encodeHdlcSyncFrame`
// deseniyle aynı ikili rol.)

export function encodeZmodemHeader(frameType: number, headerData: Uint8Array, form: ZmodemHeaderForm): Uint8Array {
  if (headerData.length !== 4) throw new RangeError(`encodeZmodemHeader: headerData.length ${headerData.length} olmalı 4`);
  const crcWidth: ZmodemCrcWidth = form === 'binary32' ? 32 : 16;
  const logical = Uint8Array.from([frameType, ...headerData]);
  const crcBytes = writeCrcBytes(calculateCrc(logical, crcWidth), crcWidth);

  if (form === 'hex16') {
    const allBytes = [...logical, ...crcBytes];
    const hex = allBytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    const chars = Array.from(hex, (c) => c.charCodeAt(0));
    return Uint8Array.from([ZPAD, ZPAD, ZDLE, ZHEX, ...chars, 0x0d, 0x0a, 0x11]);
  }

  const escapedBody = zdleEscapeBytes(Uint8Array.from([...logical, ...crcBytes]));
  return Uint8Array.from([ZPAD, ZDLE, form === 'binary32' ? ZBIN32 : ZBIN, ...escapedBody]);
}

export function encodeZmodemSubpacket(data: Uint8Array, terminator: number, crcWidth: ZmodemCrcWidth): Uint8Array {
  const crcBytes = writeCrcBytes(calculateCrc(data, crcWidth), crcWidth);
  const escapedData = zdleEscapeBytes(data);
  const escapedCrc = zdleEscapeBytes(Uint8Array.from(crcBytes));
  return Uint8Array.from([...escapedData, ZDLE, terminator, ...escapedCrc]);
}

// ── Hex yardımcıları (xmodemCore.ts/hdlcCore.ts emsali — dosya başına özel, paylaşılmaz) ──

const HEX_RADIX = 16;

export function hexByte(byte: number): string {
  return `0x${byte.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

export function hexWord(word: number): string {
  return `0x${word.toString(HEX_RADIX).toUpperCase().padStart(4, '0')}`;
}

export function hexDword(dword: number): string {
  return `0x${dword.toString(HEX_RADIX).toUpperCase().padStart(8, '0')}`;
}

export function hexString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).toUpperCase().padStart(2, '0')).join(' ');
}
